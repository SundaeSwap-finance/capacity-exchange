import {
  AssetId,
  CborSet,
  CertificateType,
  coalesceValueQuantities,
  CoreSubTransaction,
  Ed25519PublicKeyHex,
  Ed25519SignatureHex,
  isCertType,
  parseEnvelope,
  subtractValueQuantities,
  SubTransaction,
  Transaction,
  TransactionId,
  TransactionOutput,
  TransactionWitnessSet,
  Tx,
  TxIn,
  TxOut,
  Utxo,
  Value,
} from '@capacity-exchange/cardano-core';
import { minAdaRequired, minFee } from '@cardano-sdk/tx-construction';
import { CardanoWalletService } from './wallet';
import { CardanoChainStateService, CardanoProtocolParams } from './chain-state';

export interface OfferResponse {
  offerId: string;
}
export type CreateOfferResult = { status: 'ok'; response: OfferResponse } | OfferError;

export interface ValidationResponse {
  resolvedInputs: Utxo[];
}
export type ValidateResult<T> = { status: 'ok'; response: T } | OfferError;

export type OfferError =
  | { status: 'malformed'; reason: string }
  | { status: 'unsupported-version' }
  | { status: 'over-budget' };

export class CardanoOfferService {
  #wallet: CardanoWalletService;
  #chainState: CardanoChainStateService;

  constructor(wallet: CardanoWalletService, chainState: CardanoChainStateService) {
    this.#wallet = wallet;
    this.#chainState = chainState;
  }

  async createOffer(envelope: Uint8Array): Promise<CreateOfferResult> {
    const parseResult = parseEnvelope(envelope);
    if (parseResult.status !== 'ok') {
      return parseResult;
    }
    const subTx = parseResult.value;

    const validateResult = await this.validateSubTx(subTx);
    if (validateResult.status !== 'ok') {
      return validateResult;
    }

    const pparams = await this.#chainState.protocolParams();
    const buildTxResult = this.buildTx(subTx, validateResult.response, pparams);
    if (buildTxResult.status !== 'ok') {
      return buildTxResult;
    }

    await this.#wallet.signAndSubmitTx(buildTxResult.response);

    const offerId = subTx.getId();
    return { status: 'ok', response: { offerId } };
  }

  async validateSubTx(subTx: SubTransaction): Promise<ValidateResult<ValidationResponse>> {
    const sub = subTx.toCore();

    // Do not support funky forms of registration which rely on state queries.
    if (
      sub.body.certificates?.some((c) =>
        isCertType(c, [
          CertificateType.StakeRegistration,
          CertificateType.StakeDeregistration,
          CertificateType.PoolRegistration,
        ]),
      )
    ) {
      return { status: 'malformed', reason: 'sub-tx contains unsupported cert types' };
    }

    // TODO: support plutus scripts
    if (sub.witness.redeemers?.length) {
      return { status: 'malformed', reason: 'plutus scripts are not yet supported' };
    }

    const inputsToResolve = [...sub.body.inputs, ...(sub.body.referenceInputs ?? [])];
    const resolvedInputs = await this.#chainState.resolveInputs(inputsToResolve);
    if (resolvedInputs.length !== inputsToResolve.length) {
      return { status: 'malformed', reason: 'some inputs could not be resolved' };
    }

    return { status: 'ok', response: { resolvedInputs } };
  }

  buildTx(
    subTx: SubTransaction,
    { resolvedInputs }: ValidationResponse,
    pparams: CardanoProtocolParams,
  ): ValidateResult<Transaction> {
    const DUMMY_TX_ID = TransactionId('00'.repeat(32));
    const DUMMY_SIGNATURE_ID = Ed25519PublicKeyHex('00'.repeat(32));
    const DUMMY_SIGNATURE = Ed25519SignatureHex('00'.repeat(64));

    const sub = subTx.toCore();
    const unspendable = new Set(sub.body.inputs.map((txIn) => txInName(txIn)));

    // Our fee estimation logic assumes that all tx components were encoded canonically.
    // If the subtx wasn't encoded canonically, we'll underestimate its size and therefore its fees.
    // Compare the passed-in bytes (from subTx) with canonically-reencoded bytes to see how much bigger it is.
    const subSizeDelta =
      BigInt(subTx.toCbor().length / 2) - BigInt(SubTransaction.fromCore(sub).toCbor().length / 2);

    const spendableUtxos: Utxo[] = this.#wallet
      .utxos()
      .map((utxo) => [utxo.input().toCore() as Utxo[0], utxo.output().toCore()] as Utxo)
      .filter((utxo) => !unspendable.has(txInName(utxo[0])));

    const utxos = [...resolvedInputs, ...spendableUtxos];

    // What does this subtx offer to send to us, and what does it need us to provide?
    const { offers, needs } = this.findImbalance(sub, utxos);
    // TODO: confirm that we are OK with paying this price

    let fee = 1n;
    while (true) {
      // Select inputs which satisy this
      const selectInputResult = this.selectInputs(offers, needs, fee, spendableUtxos, pparams);
      if (selectInputResult.status !== 'ok') {
        return selectInputResult;
      }
      const [inputs, outputs] = selectInputResult.response;

      const tx: Tx = {
        id: DUMMY_TX_ID, // ignored,
        body: {
          inputs,
          outputs,
          subTransactions: [sub],
          fee,
        },
        witness: {
          // just here to estimate TX size including the signature
          signatures: new Map([[DUMMY_SIGNATURE_ID, DUMMY_SIGNATURE]]),
        },
      };

      const newFee =
        minFee(tx, utxos, pparams) +
        (subSizeDelta > 0n ? subSizeDelta * BigInt(pparams.minFeeCoefficient) : 0n);
      if (newFee <= fee) {
        const fullTx = Transaction.fromCore(tx);

        // attach the original subtx bytes here
        const body = fullTx.body();
        const subTransactions = CborSet.fromCore([], SubTransaction.fromCore);
        subTransactions.setValues([subTx]);
        body.setSubTransactions(subTransactions);
        fullTx.setBody(body);

        if (fullTx.toCbor().length / 2 > pparams.maxTxSize) {
          return { status: 'malformed', reason: 'transaction too big' };
        }

        // remove the dummy signature before submission
        fullTx.setWitnessSet(new TransactionWitnessSet());
        return { status: 'ok', response: fullTx };
      }
      fee = newFee;
    }
  }

  findImbalance(sub: CoreSubTransaction, resolvedInputs: Utxo[]): { offers: Value; needs: Value } {
    let coins = 0n;
    const assets = new Map<AssetId, bigint>();
    for (const input of sub.body.inputs) {
      const resolvedInput = resolvedInputs.find(
        (i) => i[0].txId === input.txId && i[0].index === input.index,
      );
      if (!resolvedInput) {
        // throwing an error rather than handling this gracefully,
        // because validation should have caught this
        throw new Error(`Missing input ${input.txId}#${input.index}`);
      }
      const inputValue = resolvedInput[1].value;
      coins += inputValue.coins;
      for (const [assetId, amount] of inputValue.assets ?? []) {
        const oldAmount = assets.get(assetId) ?? 0n;
        assets.set(assetId, oldAmount + amount);
      }
    }
    for (const output of sub.body.outputs) {
      const outputValue = output.value;
      coins -= BigInt(outputValue.coins);
      for (const [rawAssetId, rawAmount] of [...(outputValue.assets ?? [])]) {
        const assetId = AssetId(rawAssetId);
        const amount = BigInt(rawAmount);
        const oldAmount = assets.get(assetId) ?? 0n;
        assets.set(assetId, oldAmount - amount);
      }
    }

    // Withdrawals produce ADA
    for (const withdrawal of sub.body.withdrawals ?? []) {
      coins += withdrawal.quantity;
    }

    for (const cert of sub.body.certificates ?? []) {
      // stake key/drep registrations consume ADA
      if (
        isCertType(cert, [
          CertificateType.Registration,
          CertificateType.RegisterDelegateRepresentative,
          CertificateType.StakeRegistrationDelegation,
          CertificateType.StakeVoteRegistrationDelegation,
          CertificateType.VoteRegistrationDelegation,
        ])
      ) {
        coins -= cert.deposit;
      }
      // unregistrations produce ADA
      if (
        isCertType(cert, [
          CertificateType.Unregistration,
          CertificateType.UnregisterDelegateRepresentative,
        ])
      ) {
        coins += cert.deposit;
      }
    }

    // Mints produce tokens, burns consume tokens
    for (const [assetId, amount] of sub.body.mint ?? []) {
      const oldAmount = assets.get(assetId) ?? 0n;
      assets.set(assetId, oldAmount + amount);
    }

    // Proposal deposits consume ADA
    for (const proposal of sub.body.proposalProcedures ?? []) {
      coins -= proposal.deposit;
    }

    // Donations consume ADA
    if (sub.body.donation) {
      coins -= sub.body.donation;
    }

    // Direct deposits consume ADA
    for (const deposit of sub.body.directDeposits ?? []) {
      coins -= deposit.quantity;
    }

    const offers: Value = { coins: 0n };
    const needs: Value = { coins: 0n };
    if (coins > 0n) {
      offers.coins = coins;
    }
    if (coins < 0n) {
      needs.coins = -coins;
    }
    for (const [assetId, amount] of assets) {
      if (amount > 0n) {
        if (!offers.assets) {
          offers.assets = new Map();
        }
        offers.assets.set(assetId, amount);
      }
      if (amount < 0n) {
        if (!needs.assets) {
          needs.assets = new Map();
        }
        needs.assets.set(assetId, -amount);
      }
    }
    return { offers, needs };
  }

  selectInputs(
    offers: Value,
    needs: Value,
    topLevelAdaNeeded: bigint,
    spendableUtxos: Utxo[],
    pparams: CardanoProtocolParams,
  ): ValidateResult<[TxIn[], TxOut[]]> {
    const spent: Utxo[] = [];
    const unspent: Utxo[] = [...spendableUtxos];

    // if the subtx needs any native assets, fulfill those first
    const nativeAssetsNeeded = [...(needs.assets ?? [])].sort((a, b) => Number(b[1] - a[1]));
    for (const [assetId, needed] of nativeAssetsNeeded) {
      unspent.sort(assetComparatorAsc(assetId));
      let stillNeeded = needed - spent.reduce((sum, o) => sum + assetAmount(assetId, o), 0n);
      while (stillNeeded > 0n && unspent.length) {
        const next = unspent.pop()!;
        spent.push(next);
        stillNeeded -= assetAmount(assetId, next);
      }
      if (stillNeeded > 0n) {
        return { status: 'over-budget' };
      }
    }

    // once those are covered, take care of ADA
    // also make sure we spend at least one UTXO here
    unspent.sort(adaComparatorAsc);
    let adaStillNeeded =
      topLevelAdaNeeded +
      needs.coins -
      offers.coins -
      spent.reduce((sum, o) => sum + o[1].value.coins, 0n);
    while ((adaStillNeeded > 0n || !spent.length) && unspent.length) {
      const next = unspent.pop()!;
      spent.push(next);
      adaStillNeeded -= next[1].value.coins;
    }
    if (adaStillNeeded > 0n || !spent.length) {
      return { status: 'over-budget' };
    }

    // now build a change output, to help compute how much ADA we need
    const totalSpent = coalesceValueQuantities(spent.map((s) => s[1].value));
    totalSpent.coins -= topLevelAdaNeeded;
    const changeOutput: TxOut = {
      address: this.#wallet.changeAddress(),
      value: coalesceValueQuantities([offers, subtractValueQuantities([totalSpent, needs])]),
    };

    // in the unlikely event that we don't have enough ADA for min fees, add more
    const coinsPerUtxoByte = BigInt(pparams.coinsPerUtxoByte);
    let extraAdaNeeded = minAdaRequired(changeOutput, coinsPerUtxoByte) - changeOutput.value.coins;
    while (extraAdaNeeded > 0n && unspent.length) {
      const next = unspent.pop()!;
      spent.push(next);
      changeOutput.value = coalesceValueQuantities([changeOutput.value, next[1].value]);
      extraAdaNeeded = minAdaRequired(changeOutput, coinsPerUtxoByte) - changeOutput.value.coins;
    }
    if (extraAdaNeeded > 0n) {
      return { status: 'over-budget' };
    }

    // if the change output is too big, fail.
    if (
      TransactionOutput.fromCore(changeOutput).amount().toCbor().length / 2 >
      pparams.maxValueSize
    ) {
      return { status: 'malformed', reason: 'change output too large' };
    }

    return { status: 'ok', response: [spent.map((s) => s[0]), [changeOutput]] };
  }
}

function adaComparatorAsc(a: Utxo, b: Utxo): number {
  return Number(a[1].value.coins - b[1].value.coins);
}

function txInName(txIn: TxIn): string {
  return `${txIn.txId}#${txIn.index}`;
}

function assetAmount(assetId: AssetId, utxo: Utxo): bigint {
  return utxo[1].value.assets?.get(assetId) ?? 0n;
}

function assetComparatorAsc(assetId: AssetId): (a: Utxo, b: Utxo) => number {
  return (a, b) => Number(assetAmount(assetId, a) - assetAmount(assetId, b));
}
