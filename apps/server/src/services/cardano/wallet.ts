import { FastifyBaseLogger } from 'fastify';
import { Code, ConnectError, createPromiseClient, type PromiseClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { queryConnect, submitConnect, type query } from '@utxorpc/spec';
import { decode } from 'cbor2';
import {
  BODY_INPUTS,
  bytesToHex,
  type DecodedTx,
  decodeOutput,
  enterpriseAddress,
  hashBody,
  paymentKey,
  type PaymentKey,
  readInputs,
  readSigningKey,
  settleFee,
  signTx,
  subValue,
  sumValues,
  type TxInput,
  type TxOutput,
  unsignedTx,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import type { CardanoProtocolParams } from '../cardano-chain-state.js';

const RPC_TIMEOUT_MS = 10_000;
// Inputs a submitted transaction spends stay out of coin selection until the source stops
// reporting them as unspent, or until this long has passed and the transaction is presumed lost.
const PENDING_SPEND_TTL_MS = 10 * 60_000;
// What coin selection gathers beyond the target, so the change output can pay the fee and
// still meet its minimum.
const SELECTION_MARGIN_LOVELACE = 2_000_000n;

export interface WalletUtxo {
  input: TxInput;
  output: TxOutput;
}

export interface FeeParams {
  txFeeFixed: bigint;
  txFeePerByte: bigint;
  utxoCostPerByte: bigint;
}

export function feeParams(params: CardanoProtocolParams): FeeParams {
  return {
    txFeeFixed: params.minFeeConstant,
    txFeePerByte: params.minFeeCoefficient,
    utxoCostPerByte: params.coinsPerUtxoByte,
  };
}

export function utxoRef(input: TxInput): string {
  return `${input.txHash}#${input.index}`;
}

/** A datum, or a reference script, which would add a reference-script fee the fee estimate omits. */
function carriesDatumOrScript(output: TxOutput): boolean {
  if (output.rest instanceof Map) {
    return output.rest.has(2) || output.rest.has(3);
  }
  return Array.isArray(output.rest) && output.rest.length > 0;
}

/**
 * Picks UTxOs, largest lovelace first, until they cover `target` plus a margin for the fee and
 * the change minimum. Tokens they hold ride along into the change. UTxOs carrying a datum or a
 * reference script are left alone.
 */
export function selectFunding(utxos: WalletUtxo[], target: bigint): WalletUtxo[] {
  const candidates = utxos
    .filter((u) => !carriesDatumOrScript(u.output))
    .sort((a, b) => Number(b.output.value.lovelace - a.output.value.lovelace));
  const selected: WalletUtxo[] = [];
  let total = 0n;
  for (const utxo of candidates) {
    if (total >= target + SELECTION_MARGIN_LOVELACE) {
      break;
    }
    selected.push(utxo);
    total += utxo.output.value.lovelace;
  }
  if (total < target + SELECTION_MARGIN_LOVELACE) {
    throw new Error(
      `Cardano wallet holds ${total} spendable lovelace; it needs ${target + SELECTION_MARGIN_LOVELACE}`,
    );
  }
  return selected;
}

/** The server's Cardano wallet: one payment key, read and written over UTxO RPC. */
export class CardanoWalletService {
  private readonly query: PromiseClient<typeof queryConnect.QueryService>;
  private readonly submitter: PromiseClient<typeof submitConnect.SubmitService>;
  // Input ref -> when a submitted transaction spent it.
  private readonly pendingSpends = new Map<string, number>();

  private constructor(
    url: string,
    readonly key: PaymentKey,
    readonly address: Uint8Array,
    private readonly params: () => Promise<CardanoProtocolParams>,
    private readonly logger: FastifyBaseLogger,
  ) {
    const transport = createGrpcTransport({ httpVersion: '2', baseUrl: url });
    this.query = createPromiseClient(queryConnect.QueryService, transport);
    this.submitter = createPromiseClient(submitConnect.SubmitService, transport);
  }

  /** Reads the key, and the network id its address needs from the source's genesis. */
  static async create(
    url: string,
    signingKeyFile: string,
    params: () => Promise<CardanoProtocolParams>,
    logger: FastifyBaseLogger,
  ): Promise<CardanoWalletService> {
    const key = paymentKey(readSigningKey(signingKeyFile));
    const transport = createGrpcTransport({ httpVersion: '2', baseUrl: url });
    const { config } = await createPromiseClient(queryConnect.QueryService, transport).readGenesis(
      {},
      { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) },
    );
    if (config.case !== 'cardano') {
      throw new Error('UTxO RPC ReadGenesis returned no Cardano genesis');
    }
    const networkId = config.value.networkId === 'Mainnet' ? 1 : 0;
    const address = enterpriseAddress(key.keyHash, networkId);
    return new CardanoWalletService(url, key, address, params, logger);
  }

  async feeParams(): Promise<FeeParams> {
    return feeParams(await this.params());
  }

  /** The wallet's unspent outputs, minus those a submitted transaction has already spent. */
  async utxos(): Promise<WalletUtxo[]> {
    const found: WalletUtxo[] = [];
    let startToken = '';
    do {
      const response = await this.query.searchUtxos(
        {
          predicate: {
            match: {
              utxoPattern: {
                case: 'cardano',
                value: { address: { exactAddress: Uint8Array.from(this.address) } },
              },
            },
          },
          startToken,
        },
        { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) },
      );
      found.push(...response.items.map(toWalletUtxo));
      startToken = response.nextToken;
    } while (startToken);

    const unspent = new Set(found.map((u) => utxoRef(u.input)));
    const now = Date.now();
    for (const [ref, spentAt] of this.pendingSpends) {
      if (!unspent.has(ref) || now - spentAt > PENDING_SPEND_TTL_MS) {
        this.pendingSpends.delete(ref);
      }
    }
    return found.filter((u) => !this.pendingSpends.has(utxoRef(u.input)));
  }

  /** Looks up outputs by reference. A spent or unknown one is absent from the result. */
  async resolve(inputs: TxInput[]): Promise<Map<string, TxOutput>> {
    const { items } = await this.query.readUtxos(
      { keys: inputs.map((i) => ({ hash: Buffer.from(i.txHash, 'hex'), index: i.index })) },
      { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) },
    );
    return new Map(items.map(toWalletUtxo).map((u) => [utxoRef(u.input), u.output]));
  }

  /** Pays `outputs`, returning change, tokens included, to the wallet. Returns the tx id. */
  async pay(outputs: TxOutput[]): Promise<string> {
    const target = outputs.reduce((total, o) => total + o.value.lovelace, 0n);
    const selected = selectFunding(await this.utxos(), target);
    const change: TxOutput = {
      address: this.address,
      value: subValue(
        sumValues(selected.map((u) => u.output.value)),
        sumValues(outputs.map((o) => o.value)),
      ),
    };
    const tx = unsignedTx(
      selected.map((u) => u.input),
      [...outputs, change],
    );
    settleFee({ tx, changeIndex: outputs.length, ...(await this.feeParams()), witnessCount: 1 });
    return this.signAndSubmit(tx);
  }

  /**
   * Signs with the wallet's key and submits. The inputs leave selection before the call, since a
   * timeout says nothing about whether the source took the transaction, and return only when the
   * source refuses it.
   */
  async signAndSubmit(
    tx: DecodedTx,
    spends: TxInput[] = readInputs(tx.body, BODY_INPUTS),
  ): Promise<string> {
    const bytes = signTx(tx, [this.key]);
    const txId = bytesToHex(hashBody(tx.body));
    const now = Date.now();
    for (const input of spends) {
      this.pendingSpends.set(utxoRef(input), now);
    }
    try {
      await this.submitter.submitTx(
        { tx: { type: { case: 'raw', value: bytes } } },
        { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) },
      );
    } catch (err) {
      if (err instanceof ConnectError && err.code === Code.InvalidArgument) {
        for (const input of spends) {
          this.pendingSpends.delete(utxoRef(input));
        }
      }
      throw err;
    }
    this.logger.info({ txId, size: bytes.length }, 'Submitted Cardano transaction');
    return txId;
  }
}

function toWalletUtxo(item: query.AnyUtxoData): WalletUtxo {
  if (!item.txoRef) {
    throw new Error('UTxO RPC returned a UTxO with no reference');
  }
  return {
    input: { txHash: bytesToHex(item.txoRef.hash), index: item.txoRef.index },
    output: decodeOutput(decode(item.nativeBytes)),
  };
}
