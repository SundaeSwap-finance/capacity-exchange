import { describe, it, expect } from 'vitest';
import { Cardano } from '@cardano-sdk/core';
import {
  Address,
  BlockId,
  BlockNo,
  PartialBlockHeader,
  Slot,
  Transaction,
} from '@capacity-exchange/cardano-core';
import { CardanoWalletService } from './wallet.js';
import { MAX_ROLLBACK_DEPTH } from './utils.js';

const hash28 = (byte: number) => byte.toString(16).padStart(2, '0').repeat(28);
const hash32 = (byte: number) => byte.toString(16).padStart(2, '0').repeat(32);

const keyCredential = (byte: number): Cardano.Credential => ({
  type: Cardano.CredentialType.KeyHash,
  hash: hash28(byte) as Cardano.Credential['hash'],
});
const scriptCredential = (byte: number): Cardano.Credential => ({
  type: Cardano.CredentialType.ScriptHash,
  hash: hash28(byte) as Cardano.Credential['hash'],
});

const baseAddress = (payment: Cardano.Credential, stake: Cardano.Credential) =>
  Cardano.BaseAddress.fromCredentials(Cardano.NetworkId.Testnet, payment, stake)
    .toAddress()
    .toBech32();
const enterpriseAddress = (payment: Cardano.Credential) =>
  Cardano.EnterpriseAddress.fromCredentials(Cardano.NetworkId.Testnet, payment)
    .toAddress()
    .toBech32();

const OURS = keyCredential(1);
const WALLET_ADDRESS = baseAddress(OURS, keyCredential(2));
const SOMEONE_ELSE = baseAddress(keyCredential(3), keyCredential(2));

const header = (slot: number): PartialBlockHeader => ({
  blockNo: BlockNo(slot),
  slot: Slot(slot),
  hash: BlockId(slot.toString(16).padStart(64, '0')),
});

/** An input spending an output of a transaction outside the test. */
const externalInput = (byte: number, index = 0): Cardano.TxIn => ({
  txId: Cardano.TransactionId(hash32(byte)),
  index,
});

const output = (address: string, coins = 2_000_000n): Cardano.TxOut => ({
  address: Cardano.PaymentAddress(address),
  value: { coins },
});

interface TxSpec {
  inputs: Cardano.TxIn[];
  outputs: Cardano.TxOut[];
  collaterals?: Cardano.TxIn[];
  collateralReturn?: Cardano.TxOut;
  isValid?: boolean;
}

// The id passed to fromCore is ignored by getId(), which hashes the body.
const PLACEHOLDER_ID = Cardano.TransactionId(hash32(0));

function tx(
  { inputs, outputs, collaterals, collateralReturn, isValid }: TxSpec,
  subTransactions: TxSpec[] = [],
): Transaction {
  return Transaction.fromCore({
    id: PLACEHOLDER_ID,
    isValid,
    body: {
      inputs,
      outputs,
      collaterals,
      collateralReturn,
      fee: 200_000n,
      subTransactions: subTransactions.length
        ? subTransactions.map((sub) => ({
            body: { inputs: sub.inputs, outputs: sub.outputs },
            witness: { signatures: new Map() },
          }))
        : undefined,
    },
    witness: { signatures: new Map() },
  });
}

/** The input that spends output `index` of `tx`. */
const spend = (tx: { getId(): Cardano.TransactionId }, index = 0): Cardano.TxIn => ({
  txId: tx.getId(),
  index,
});

const subTx = (parent: Transaction, i: number) => [...parent.body().subTransactions()!.values()][i];

/** The wallet's UTxOs as `txId#index` refs, sorted. */
function refs(wallet: CardanoWalletService): string[] {
  return wallet
    .utxos()
    .map((utxo) => `${utxo.input().transactionId()}#${utxo.input().index()}`)
    .sort();
}
const ref = (tx: { getId(): Cardano.TransactionId }, index = 0) => `${tx.getId()}#${index}`;

const newWallet = () => new CardanoWalletService(Address.fromBech32(WALLET_ADDRESS));

describe('CardanoWalletService', () => {
  it('starts with no UTxOs', () => {
    expect(newWallet().utxos()).toEqual([]);
  });

  describe('picking up UTxOs', () => {
    it('tracks outputs to the wallet address and ignores others', async () => {
      const wallet = newWallet();
      const t = tx({
        inputs: [externalInput(10)],
        outputs: [output(SOMEONE_ELSE), output(WALLET_ADDRESS, 5_000_000n), output(SOMEONE_ELSE)],
      });
      await wallet.onRollForward(header(1), [t]);

      expect(refs(wallet)).toEqual([ref(t, 1)]);
      const [utxo] = wallet.utxos();
      expect(utxo.output().address().toBech32()).toBe(WALLET_ADDRESS);
      expect(utxo.output().amount().coin()).toBe(5_000_000n);
    });

    it('tracks outputs with the same payment credential regardless of delegation', async () => {
      const wallet = newWallet();
      const t = tx({
        inputs: [externalInput(10)],
        outputs: [
          output(baseAddress(OURS, keyCredential(4))),
          output(baseAddress(OURS, scriptCredential(5))),
          output(enterpriseAddress(OURS)),
        ],
      });
      await wallet.onRollForward(header(1), [t]);

      expect(refs(wallet)).toEqual([ref(t, 0), ref(t, 1), ref(t, 2)].sort());
    });

    it('ignores a script credential with the same hash as the payment key', async () => {
      const wallet = newWallet();
      const t = tx({
        inputs: [externalInput(10)],
        outputs: [output(enterpriseAddress(scriptCredential(1)))],
      });
      await wallet.onRollForward(header(1), [t]);

      expect(wallet.utxos()).toEqual([]);
    });

    it('drops UTxOs once they are spent', async () => {
      const wallet = newWallet();
      const funding = tx({
        inputs: [externalInput(10)],
        outputs: [output(WALLET_ADDRESS), output(WALLET_ADDRESS)],
      });
      await wallet.onRollForward(header(1), [funding]);
      const spending = tx({ inputs: [spend(funding, 0)], outputs: [output(SOMEONE_ELSE)] });
      await wallet.onRollForward(header(2), [spending]);

      expect(refs(wallet)).toEqual([ref(funding, 1)]);
    });

    it('applies transactions in a block in order', async () => {
      const wallet = newWallet();
      const funding = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      const change = tx({
        inputs: [spend(funding)],
        outputs: [output(SOMEONE_ELSE), output(WALLET_ADDRESS)],
      });
      await wallet.onRollForward(header(1), [funding, change]);

      expect(refs(wallet)).toEqual([ref(change, 1)]);
    });

    it('tracks outputs of sub-transactions under their own ids', async () => {
      const wallet = newWallet();
      const t = tx({ inputs: [externalInput(10)], outputs: [output(SOMEONE_ELSE)] }, [
        { inputs: [externalInput(11)], outputs: [output(SOMEONE_ELSE), output(WALLET_ADDRESS)] },
        { inputs: [externalInput(12)], outputs: [output(enterpriseAddress(OURS))] },
      ]);
      await wallet.onRollForward(header(1), [t]);

      expect(refs(wallet)).toEqual([ref(subTx(t, 0), 1), ref(subTx(t, 1), 0)].sort());
      expect(refs(wallet)).not.toContain(ref(t, 1));
    });

    it('drops UTxOs spent by a sub-transaction', async () => {
      const wallet = newWallet();
      const funding = tx({
        inputs: [externalInput(10)],
        outputs: [output(WALLET_ADDRESS), output(WALLET_ADDRESS)],
      });
      await wallet.onRollForward(header(1), [funding]);
      const t = tx({ inputs: [externalInput(11)], outputs: [output(SOMEONE_ELSE)] }, [
        { inputs: [spend(funding, 1)], outputs: [output(SOMEONE_ELSE)] },
      ]);
      await wallet.onRollForward(header(2), [t]);

      expect(refs(wallet)).toEqual([ref(funding, 0)]);
    });
  });

  describe('transactions that failed phase-2 validation', () => {
    it('leaves their inputs unspent and ignores their outputs', async () => {
      const wallet = newWallet();
      const funding = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(1), [funding]);
      const failed = tx({
        inputs: [spend(funding)],
        outputs: [output(WALLET_ADDRESS)],
        collaterals: [externalInput(11)],
        isValid: false,
      });
      await wallet.onRollForward(header(2), [failed]);

      expect(refs(wallet)).toEqual([ref(funding)]);
    });

    it('spends their collateral', async () => {
      const wallet = newWallet();
      const funding = tx({
        inputs: [externalInput(10)],
        outputs: [output(WALLET_ADDRESS), output(WALLET_ADDRESS)],
      });
      await wallet.onRollForward(header(1), [funding]);
      const failed = tx({
        inputs: [externalInput(11)],
        outputs: [output(SOMEONE_ELSE)],
        collaterals: [spend(funding, 1)],
        isValid: false,
      });
      await wallet.onRollForward(header(2), [failed]);

      expect(refs(wallet)).toEqual([ref(funding, 0)]);
    });

    it('tracks a collateral return to the wallet, indexed after the outputs', async () => {
      const wallet = newWallet();
      const failed = tx({
        inputs: [externalInput(10)],
        outputs: [output(SOMEONE_ELSE), output(WALLET_ADDRESS)],
        collaterals: [externalInput(11)],
        collateralReturn: output(enterpriseAddress(OURS), 3_000_000n),
        isValid: false,
      });
      await wallet.onRollForward(header(1), [failed]);

      expect(refs(wallet)).toEqual([ref(failed, 2)]);
      expect(wallet.utxos()[0].output().amount().coin()).toBe(3_000_000n);
    });

    it('ignores a collateral return to someone else', async () => {
      const wallet = newWallet();
      const failed = tx({
        inputs: [externalInput(10)],
        outputs: [],
        collaterals: [externalInput(11)],
        collateralReturn: output(SOMEONE_ELSE),
        isValid: false,
      });
      await wallet.onRollForward(header(1), [failed]);

      expect(wallet.utxos()).toEqual([]);
    });

    it('ignores their sub-transactions', async () => {
      const wallet = newWallet();
      const funding = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(1), [funding]);
      const failed = tx(
        {
          inputs: [externalInput(11)],
          outputs: [],
          collaterals: [externalInput(12)],
          isValid: false,
        },
        [{ inputs: [spend(funding)], outputs: [output(WALLET_ADDRESS)] }],
      );
      await wallet.onRollForward(header(2), [failed]);

      expect(refs(wallet)).toEqual([ref(funding)]);
    });

    it('leaves the collateral and collateral return of a valid transaction alone', async () => {
      const wallet = newWallet();
      const funding = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(1), [funding]);
      const valid = tx({
        inputs: [externalInput(11)],
        outputs: [output(SOMEONE_ELSE)],
        collaterals: [spend(funding)],
        collateralReturn: output(WALLET_ADDRESS),
      });
      await wallet.onRollForward(header(2), [valid]);

      expect(refs(wallet)).toEqual([ref(funding)]);
    });

    it('restores spent collateral when rolled back', async () => {
      const wallet = newWallet();
      const funding = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(1), [funding]);
      await wallet.onRollForward(header(2), [
        tx({
          inputs: [externalInput(11)],
          outputs: [],
          collaterals: [spend(funding)],
          collateralReturn: output(WALLET_ADDRESS),
          isValid: false,
        }),
      ]);

      await wallet.onRollBackward(header(1));

      expect(refs(wallet)).toEqual([ref(funding)]);
    });
  });

  describe('rollbacks', () => {
    it('undoes blocks after the rollback slot', async () => {
      const wallet = newWallet();
      const first = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      const second = tx({ inputs: [externalInput(11)], outputs: [output(WALLET_ADDRESS)] });
      const third = tx({ inputs: [externalInput(12)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(10), [first]);
      await wallet.onRollForward(header(20), [second]);
      await wallet.onRollForward(header(30), [third]);

      await wallet.onRollBackward(header(10));

      expect(refs(wallet)).toEqual([ref(first)]);
    });

    it('keeps the block at the rollback slot', async () => {
      const wallet = newWallet();
      const first = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      const second = tx({ inputs: [externalInput(11)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(10), [first]);
      await wallet.onRollForward(header(20), [second]);

      await wallet.onRollBackward(header(20));

      expect(refs(wallet)).toEqual([ref(first), ref(second)].sort());
    });

    it('undoes blocks after a rollback to a slot with no block', async () => {
      const wallet = newWallet();
      const first = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      const second = tx({ inputs: [externalInput(11)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(10), [first]);
      await wallet.onRollForward(header(20), [second]);

      await wallet.onRollBackward(header(15));

      expect(refs(wallet)).toEqual([ref(first)]);
    });

    it('undoes every transaction in a rolled-back block', async () => {
      const wallet = newWallet();
      const first = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      const second = tx({ inputs: [externalInput(11)], outputs: [output(WALLET_ADDRESS)] });
      const third = tx({ inputs: [externalInput(12)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(10), [first]);
      await wallet.onRollForward(header(20), [second, third]);

      await wallet.onRollBackward(header(10));

      expect(refs(wallet)).toEqual([ref(first)]);
    });

    it('rolls back to the start, before any block', async () => {
      const wallet = newWallet();
      await wallet.onRollForward(header(10), [
        tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] }),
      ]);

      await wallet.onRollBackward(header(0));

      expect(wallet.utxos()).toEqual([]);
    });

    it('restores UTxOs spent in a rolled-back block', async () => {
      const wallet = newWallet();
      const funding = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(10), [funding]);
      await wallet.onRollForward(header(20), [
        tx({ inputs: [spend(funding)], outputs: [output(SOMEONE_ELSE)] }),
      ]);
      expect(wallet.utxos()).toEqual([]);

      await wallet.onRollBackward(header(10));

      expect(refs(wallet)).toEqual([ref(funding)]);
    });

    it('restores UTxOs spent by a sub-transaction in a rolled-back block', async () => {
      const wallet = newWallet();
      const funding = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(10), [funding]);
      const t = tx({ inputs: [externalInput(11)], outputs: [output(SOMEONE_ELSE)] }, [
        { inputs: [spend(funding)], outputs: [output(WALLET_ADDRESS)] },
      ]);
      await wallet.onRollForward(header(20), [t]);
      expect(refs(wallet)).toEqual([ref(subTx(t, 0))]);

      await wallet.onRollBackward(header(10));

      expect(refs(wallet)).toEqual([ref(funding)]);
    });

    it('follows the new chain after a rollback', async () => {
      const wallet = newWallet();
      const funding = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      const orphaned = tx({ inputs: [externalInput(11)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(10), [funding]);
      await wallet.onRollForward(header(20), [orphaned]);

      await wallet.onRollBackward(header(10));
      const replacement = tx({
        inputs: [spend(funding)],
        outputs: [output(SOMEONE_ELSE), output(WALLET_ADDRESS)],
      });
      await wallet.onRollForward(header(21), [replacement]);

      expect(refs(wallet)).toEqual([ref(replacement, 1)]);
    });

    it('can roll back again after following the new chain', async () => {
      const wallet = newWallet();
      const funding = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(10), [funding]);
      await wallet.onRollForward(header(20), [
        tx({ inputs: [spend(funding)], outputs: [output(SOMEONE_ELSE)] }),
      ]);
      await wallet.onRollBackward(header(10));
      const replacement = tx({ inputs: [externalInput(11)], outputs: [output(WALLET_ADDRESS)] });
      await wallet.onRollForward(header(25), [replacement]);
      await wallet.onRollForward(header(30), [
        tx({ inputs: [spend(replacement)], outputs: [output(SOMEONE_ELSE)] }),
      ]);
      expect(refs(wallet)).toEqual([ref(funding)]);

      await wallet.onRollBackward(header(25));
      expect(refs(wallet)).toEqual([ref(funding), ref(replacement)].sort());

      await wallet.onRollBackward(header(10));
      expect(refs(wallet)).toEqual([ref(funding)]);
    });

    it('rolls back the full depth once history has been trimmed', async () => {
      const wallet = newWallet();
      // Each block moves the wallet's one UTxO on, so the tip block identifies the state.
      const chain = [tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] })];
      await wallet.onRollForward(header(1), [chain[0]]);
      for (let slot = 2; slot <= MAX_ROLLBACK_DEPTH + 10; slot++) {
        const next = tx({ inputs: [spend(chain.at(-1)!)], outputs: [output(WALLET_ADDRESS)] });
        await wallet.onRollForward(header(slot), [next]);
        chain.push(next);
      }

      const rollbackTo = chain.length - MAX_ROLLBACK_DEPTH;
      await wallet.onRollBackward(header(rollbackTo));

      expect(refs(wallet)).toEqual([ref(chain[rollbackTo - 1])]);
    }, 30_000);
  });
});
