import { describe, it, expect, vi } from 'vitest';
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
import { seedToSigningKey } from '../../config/cardanoKeys.js';
import type { SubmitTxResult } from './chain-state.js';

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
  ttl?: number;
}

// The id passed to fromCore is ignored by getId(), which hashes the body.
const PLACEHOLDER_ID = Cardano.TransactionId(hash32(0));

function tx(
  { inputs, outputs, collaterals, collateralReturn, isValid, ttl }: TxSpec,
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
      validityInterval: ttl === undefined ? undefined : { invalidHereafter: Slot(ttl) },
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
const walletKeyPair = seedToSigningKey(new Uint8Array(32).fill(7));

const newWallet = (
  submit: (tx: Transaction) => Promise<SubmitTxResult> = async () => ({ status: 'ok' }),
) =>
  new CardanoWalletService(Address.fromBech32(WALLET_ADDRESS), walletKeyPair, {
    addFollower() {
      // do nothing. it's simpler to manually call the roll forward/back methods.
    },
    submit: vi.fn(submit),
  } as any);

describe('CardanoWalletService chain following', () => {
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

  it('totals the lovelace in its UTxOs', async () => {
    const wallet = newWallet();
    expect(wallet.lovelace()).toBe(0n);
    const funding = tx({
      inputs: [externalInput(10)],
      outputs: [
        output(WALLET_ADDRESS, 1_000_000n),
        output(SOMEONE_ELSE, 7_000_000n),
        output(enterpriseAddress(OURS), 2_500_000n),
      ],
    });
    await wallet.onRollForward(header(1), [funding]);
    expect(wallet.lovelace()).toBe(3_500_000n);

    await wallet.onRollForward(header(2), [
      tx({ inputs: [spend(funding, 0)], outputs: [output(SOMEONE_ELSE)] }),
    ]);
    expect(wallet.lovelace()).toBe(2_500_000n);
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

describe('CardanoWalletService submitting transactions', () => {
  /** A wallet holding one confirmed UTxO per entry in `coins`, funded in slot 10. */
  async function fundedWallet(
    submit?: (tx: Transaction) => Promise<SubmitTxResult>,
    coins: bigint[] = [10_000_000n],
  ) {
    const wallet = newWallet(submit);
    const funding = tx({
      inputs: [externalInput(10)],
      outputs: coins.map((c) => output(WALLET_ADDRESS, c)),
    });
    await wallet.onRollForward(header(10), [funding]);
    return { wallet, funding };
  }

  /** A transaction spending `inputs`, paying someone else and returning change to the wallet. */
  const payment = (inputs: Cardano.TxIn[], ttl: number) =>
    tx({ inputs, outputs: [output(SOMEONE_ELSE), output(WALLET_ADDRESS)], ttl });

  it('signs the transaction with the wallet key before submitting it', async () => {
    let submitted: Transaction | undefined;
    const { wallet, funding } = await fundedWallet(async (t) => {
      submitted = t;
      return { status: 'ok' };
    });

    await wallet.signAndSubmitTx(payment([spend(funding)], 100));

    const vkeys = [...(submitted!.witnessSet().vkeys()?.values() ?? [])];
    expect(vkeys.map((w) => w.vkey())).toEqual([
      Buffer.from(walletKeyPair.publicKey).toString('hex'),
    ]);
  });

  it('reserves the inputs while the submission is in flight', async () => {
    let finish!: (result: SubmitTxResult) => void;
    const { wallet, funding } = await fundedWallet(
      () => new Promise((resolve) => (finish = resolve)),
      [5_000_000n, 5_000_000n],
    );

    const submitting = wallet.signAndSubmitTx(payment([spend(funding, 0)], 100));
    expect(refs(wallet)).toEqual([ref(funding, 1)]);

    finish({ status: 'ok' });
    await submitting;
  });

  it('keeps the inputs reserved and tracks change once submitted', async () => {
    const { wallet, funding } = await fundedWallet();
    const t = payment([spend(funding)], 100);

    const result = await wallet.signAndSubmitTx(t);

    expect(result).toEqual({ status: 'ok' });
    expect(refs(wallet)).toEqual([ref(t, 1)]);
  });

  it('counts pending change, and not reserved inputs, in its lovelace', async () => {
    const { wallet, funding } = await fundedWallet();
    const t = tx({
      inputs: [spend(funding)],
      outputs: [output(SOMEONE_ELSE, 4_000_000n), output(WALLET_ADDRESS, 3_000_000n)],
      ttl: 100,
    });

    await wallet.signAndSubmitTx(t);

    expect(wallet.lovelace()).toBe(3_000_000n);
  });

  it('tracks pending outputs of sub-transactions under their own ids', async () => {
    const { wallet, funding } = await fundedWallet();
    const t = tx({ inputs: [spend(funding)], outputs: [output(SOMEONE_ELSE)], ttl: 100 }, [
      { inputs: [externalInput(20)], outputs: [output(SOMEONE_ELSE), output(WALLET_ADDRESS)] },
    ]);

    await wallet.signAndSubmitTx(t);

    expect(refs(wallet)).toEqual([ref(subTx(t, 0), 1)]);
  });

  it('reserves wallet UTxOs spent by a sub-transaction', async () => {
    const { wallet, funding } = await fundedWallet(undefined, [5_000_000n, 5_000_000n]);
    const t = tx({ inputs: [spend(funding, 0)], outputs: [output(SOMEONE_ELSE)], ttl: 100 }, [
      { inputs: [spend(funding, 1)], outputs: [output(SOMEONE_ELSE)] },
    ]);

    await wallet.signAndSubmitTx(t);

    expect(refs(wallet)).toEqual([]);
  });

  it('frees wallet UTxOs spent by a sub-transaction when submission fails', async () => {
    const { wallet, funding } = await fundedWallet(
      async () => ({ status: 'error', reason: 'rejected' }),
      [5_000_000n, 5_000_000n],
    );
    const t = tx({ inputs: [spend(funding, 0)], outputs: [output(SOMEONE_ELSE)], ttl: 100 }, [
      { inputs: [spend(funding, 1)], outputs: [output(SOMEONE_ELSE)] },
    ]);

    await wallet.signAndSubmitTx(t);

    expect(refs(wallet)).toEqual([ref(funding, 0), ref(funding, 1)].sort());
  });

  it("drops a sub-transaction's outputs when pending change it spends expires", async () => {
    const { wallet, funding } = await fundedWallet(undefined, [5_000_000n, 5_000_000n]);
    const parent = payment([spend(funding, 0)], 100);
    await wallet.signAndSubmitTx(parent);
    const child = tx({ inputs: [spend(funding, 1)], outputs: [output(SOMEONE_ELSE)], ttl: 110 }, [
      { inputs: [spend(parent, 1)], outputs: [output(WALLET_ADDRESS)] },
    ]);
    await wallet.signAndSubmitTx(child);
    expect(refs(wallet)).toEqual([ref(subTx(child, 0))]);

    await wallet.onRollForward(header(100), []);

    // The parent never landed, so neither can the child; only funding#0 comes back,
    // since funding#1 stays reserved by the child until its own TTL.
    expect(refs(wallet)).toEqual([ref(funding, 0)]);
  });

  it('frees the inputs and tracks nothing when submission fails', async () => {
    const { wallet, funding } = await fundedWallet(async () => ({
      status: 'error',
      reason: 'rejected',
    }));

    const result = await wallet.signAndSubmitTx(payment([spend(funding)], 100));

    expect(result).toEqual({ status: 'error', reason: 'rejected' });
    expect(refs(wallet)).toEqual([ref(funding)]);
  });

  it('frees the inputs when submission times out', async () => {
    const { wallet, funding } = await fundedWallet(async () => ({
      status: 'error',
      reason: 'submission timed out',
    }));

    await wallet.signAndSubmitTx(payment([spend(funding)], 100));

    expect(refs(wallet)).toEqual([ref(funding)]);
  });

  it('reserves inputs until the TTL passes if the transaction never lands', async () => {
    const { wallet, funding } = await fundedWallet();
    const t = payment([spend(funding)], 100);
    await wallet.signAndSubmitTx(t);

    await wallet.onRollForward(header(99), []);
    expect(refs(wallet)).toEqual([ref(t, 1)]);

    await wallet.onRollForward(header(100), []);
    expect(refs(wallet)).toEqual([ref(funding)]);
  });

  it('reserves inputs for 20 slots past the tip when the transaction has no TTL', async () => {
    const { wallet, funding } = await fundedWallet();
    const t = tx({ inputs: [spend(funding)], outputs: [output(WALLET_ADDRESS)] });
    await wallet.signAndSubmitTx(t);

    await wallet.onRollForward(header(29), []);
    expect(refs(wallet)).toEqual([ref(t)]);

    await wallet.onRollForward(header(30), []);
    expect(refs(wallet)).toEqual([ref(funding)]);
  });

  it('replaces pending outputs with confirmed ones when the transaction lands', async () => {
    const { wallet, funding } = await fundedWallet();
    const t = payment([spend(funding)], 100);
    await wallet.signAndSubmitTx(t);

    await wallet.onRollForward(header(20), [t]);
    expect(refs(wallet)).toEqual([ref(t, 1)]);

    // Confirmed outputs no longer expire with the transaction's TTL.
    await wallet.onRollForward(header(200), []);
    expect(refs(wallet)).toEqual([ref(t, 1)]);
  });

  it('keeps reservations and pending outputs through a rollback', async () => {
    const { wallet, funding } = await fundedWallet();
    await wallet.onRollForward(header(20), [
      tx({ inputs: [externalInput(11)], outputs: [output(SOMEONE_ELSE)] }),
    ]);
    const t = payment([spend(funding)], 100);
    await wallet.signAndSubmitTx(t);

    await wallet.onRollBackward(header(10));

    expect(refs(wallet)).toEqual([ref(t, 1)]);
  });

  it('hides change while a rollback undoes the block that funded it', async () => {
    const wallet = newWallet();
    const funding = tx({ inputs: [externalInput(10)], outputs: [output(WALLET_ADDRESS)] });
    await wallet.onRollForward(header(10), [funding]);
    const t = payment([spend(funding)], 100);
    await wallet.signAndSubmitTx(t);

    await wallet.onRollBackward(header(5));
    expect(refs(wallet)).toEqual([]);

    await wallet.onRollForward(header(11), [funding]);
    expect(refs(wallet)).toEqual([ref(t, 1)]);
  });

  it('drops change when a rival transaction spends its input on chain', async () => {
    const { wallet, funding } = await fundedWallet();
    await wallet.signAndSubmitTx(payment([spend(funding)], 100));

    const rival = tx({ inputs: [spend(funding)], outputs: [output(SOMEONE_ELSE)] });
    await wallet.onRollForward(header(20), [rival]);

    expect(refs(wallet)).toEqual([]);
  });

  it('reserves inputs again when a rollback returns to before the TTL', async () => {
    const { wallet, funding } = await fundedWallet();
    await wallet.signAndSubmitTx(payment([spend(funding)], 100));
    await wallet.onRollForward(header(100), []);
    expect(refs(wallet)).toEqual([ref(funding)]);

    // The new fork's blocks may come before slot 100, so the payment could still land.
    await wallet.onRollBackward(header(10));
    expect(refs(wallet)).toEqual([]);

    await wallet.onRollForward(header(100), []);
    expect(refs(wallet)).toEqual([ref(funding)]);
  });

  it('does not let a restored reservation hide inputs once the payment lands', async () => {
    const { wallet, funding } = await fundedWallet();
    const t = payment([spend(funding)], 100);
    await wallet.signAndSubmitTx(t);
    await wallet.onRollForward(header(100), []);
    await wallet.onRollBackward(header(10));

    await wallet.onRollForward(header(50), [t]);

    expect(refs(wallet)).toEqual([ref(t, 1)]);
  });

  describe('chaining', () => {
    /** Submits a parent paying change to the wallet, then a child spending that change. */
    async function submitChain(parentTtl: number, childTtl: number) {
      const { wallet, funding } = await fundedWallet();
      const parent = payment([spend(funding)], parentTtl);
      await wallet.signAndSubmitTx(parent);
      const child = payment([spend(parent, 1)], childTtl);
      await wallet.signAndSubmitTx(child);
      return { wallet, funding, parent, child };
    }

    it('spends pending change in a child transaction', async () => {
      const { wallet, child } = await submitChain(100, 110);

      expect(refs(wallet)).toEqual([ref(child, 1)]);
    });

    it('keeps the change a child spent reserved when the parent lands', async () => {
      const { wallet, parent, child } = await submitChain(100, 110);

      await wallet.onRollForward(header(20), [parent]);

      expect(refs(wallet)).toEqual([ref(child, 1)]);
    });

    it("keeps a child's outputs past the parent's TTL once the parent lands", async () => {
      const { wallet, parent, child } = await submitChain(100, 110);
      await wallet.onRollForward(header(20), [parent]);

      await wallet.onRollForward(header(105), []);

      expect(refs(wallet)).toEqual([ref(child, 1)]);
    });

    it("drops a child's outputs when the parent expires without landing", async () => {
      const { wallet, funding } = await submitChain(100, 110);

      await wallet.onRollForward(header(100), []);

      // The child can never land, so its outputs are gone; its only input
      // was the parent's change, so nothing else comes back.
      expect(refs(wallet)).toEqual([ref(funding)]);
    });

    it('drops every descendant when an ancestor expires', async () => {
      const { wallet, funding, child } = await submitChain(100, 110);
      const grandchild = payment([spend(child, 1)], 120);
      await wallet.signAndSubmitTx(grandchild);
      expect(refs(wallet)).toEqual([ref(grandchild, 1)]);

      await wallet.onRollForward(header(100), []);

      expect(refs(wallet)).toEqual([ref(funding)]);
    });

    it('tracks a parent and child landing in the same block', async () => {
      const { wallet, parent, child } = await submitChain(100, 110);

      await wallet.onRollForward(header(20), [parent, child]);
      await wallet.onRollForward(header(200), []);

      expect(refs(wallet)).toEqual([ref(child, 1)]);
    });

    it('forgets the change a child spent when both land in the same block', async () => {
      // The child expires first, so its reservation of the parent's change goes away
      // while the parent's pending entry would still be live.
      const { wallet, parent, child } = await submitChain(300, 100);

      await wallet.onRollForward(header(20), [parent, child]);
      await wallet.onRollForward(header(100), []);

      expect(refs(wallet)).toEqual([ref(child, 1)]);
    });

    it('keeps depending on a parent which lands while the child is being submitted', async () => {
      let finish: ((result: SubmitTxResult) => void) | undefined;
      let deferNextSubmit = false;
      const { wallet, funding } = await fundedWallet(async () => {
        if (!deferNextSubmit) {
          return { status: 'ok' };
        }
        return new Promise((resolve) => (finish = resolve));
      });
      const parent = payment([spend(funding)], 100);
      await wallet.signAndSubmitTx(parent);

      deferNextSubmit = true;
      const child = payment([spend(parent, 1)], 110);
      const submitting = wallet.signAndSubmitTx(child);
      await wallet.onRollForward(header(20), [parent]);
      finish!({ status: 'ok' });
      await submitting;
      expect(refs(wallet)).toEqual([ref(child, 1)]);

      // The parent's block is undone and the parent never lands again. Once its TTL
      // passes, the funding it reserved comes back, but the child's change does not.
      await wallet.onRollBackward(header(10));
      await wallet.onRollForward(header(100), []);

      expect(refs(wallet)).toEqual([ref(funding)]);
    });

    it("hides a child's outputs while a rollback undoes the parent's block", async () => {
      const { wallet, parent, child } = await submitChain(100, 110);
      await wallet.onRollForward(header(20), [parent]);

      await wallet.onRollBackward(header(10));
      expect(refs(wallet)).toEqual([]);

      await wallet.onRollForward(header(21), [parent]);
      expect(refs(wallet)).toEqual([ref(child, 1)]);
    });
  });
});
