import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { SubmitTxResult } from './chain-state.js';
import type { CardanoWalletService } from './wallet.js';
import {
  SOMEONE_ELSE,
  WALLET_ADDRESS,
  type TxSpec,
  externalInput,
  header,
  newWallet,
  output,
  refs,
  reload,
  tx,
} from './wallet-test-utils.js';

type Outcome = 'ok' | 'rejected' | 'unknown';

type Op =
  | { kind: 'fund'; outputs: number }
  | { kind: 'empty'; slots: number }
  | { kind: 'submit'; pick: number; ttl: number; outcome: Outcome; landsInFlight: boolean }
  | { kind: 'land'; pick: number }
  | { kind: 'rollback'; depth: number }
  | { kind: 'reload' };

const op: fc.Arbitrary<Op> = fc.oneof(
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('fund' as const),
      outputs: fc.integer({ min: 1, max: 3 }),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('empty' as const),
      slots: fc.integer({ min: 1, max: 20 }),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('submit' as const),
      pick: fc.nat(),
      ttl: fc.integer({ min: 1, max: 40 }),
      outcome: fc.constantFrom<Outcome>('ok', 'rejected', 'unknown'),
      landsInFlight: fc.boolean(),
    }),
  },
  { weight: 4, arbitrary: fc.record({ kind: fc.constant('land' as const), pick: fc.nat() }) },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('rollback' as const),
      depth: fc.integer({ min: 1, max: 5 }),
    }),
  },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('reload' as const) }) },
);

const SUBMIT_RESULTS: Record<Outcome, SubmitTxResult> = {
  ok: { status: 'ok', reachedMempool: true },
  rejected: { status: 'error', reason: 'rejected', reachedMempool: false },
  unknown: { status: 'error', reason: 'timed out' },
};

interface ChainTx {
  id: string;
  spec: TxSpec;
}

interface Block {
  slot: number;
  txs: ChainTx[];
}

interface Submission extends ChainTx {
  inputs: string[];
  change: string;
  ttl: number;
  /** The node took it, so the wallet tracks its change as pending. */
  accepted: boolean;
  mayBeInMempool: boolean;
}

const chainTx = (spec: TxSpec): ChainTx => ({ id: tx(spec).getId(), spec });

/**
 * A chain the test drives, and the wallets following it. `blocks` holds only the
 * blocks no rollback has undone, so it is what a wallet that never saw a rollback
 * would have been fed.
 */
class World {
  readonly blocks: Block[] = [];
  readonly submissions: Submission[] = [];
  #submitResult = SUBMIT_RESULTS.ok;
  #fundings = 0;
  /** A block each wallet sees while its submission has not returned yet. */
  #inFlight: Block | null = null;

  readonly #submitFrom = (wallet: () => CardanoWalletService) => async () => {
    if (this.#inFlight) {
      await wallet().onRollForward(
        header(this.#inFlight.slot),
        this.#inFlight.txs.map((t) => tx(t.spec)),
      );
    }
    return this.#submitResult;
  };
  readonly #walletSubmit = this.#submitFrom(() => this.wallet);

  wallet: CardanoWalletService = newWallet(this.#walletSubmit);
  /** Sees everything `wallet` does, but is never saved and loaded. */
  readonly twin: CardanoWalletService = newWallet(this.#submitFrom(() => this.twin));

  slot(): number {
    return this.blocks.at(-1)?.slot ?? 0;
  }

  /** The wallet's unspent outputs on the surviving chain, by ref, with their lovelace. */
  confirmed(): Map<string, bigint> {
    const utxos = new Map<string, bigint>();
    for (const block of this.blocks) {
      for (const { id, spec } of block.txs) {
        for (const input of spec.inputs) {
          utxos.delete(`${input.txId}#${input.index}`);
        }
        spec.outputs.forEach((out, index) => {
          if (out.address === WALLET_ADDRESS) {
            utxos.set(`${id}#${index}`, out.value.coins);
          }
        });
      }
    }
    return utxos;
  }

  /** Whether `ref` is unspent on the surviving chain, or is change that can still be created. */
  canExist(ref: string, confirmed = this.confirmed()): boolean {
    if (confirmed.has(ref)) {
      return true;
    }
    return this.submissions.some(
      (s) =>
        s.change === ref &&
        s.accepted &&
        !this.landed(s) &&
        this.slot() < s.ttl &&
        s.inputs.every((input) => this.canExist(input, confirmed)),
    );
  }

  landed(submission: Submission): boolean {
    return this.blocks.some((block) => block.txs.some((t) => t.id === submission.id));
  }

  async apply(op: Op): Promise<void> {
    switch (op.kind) {
      case 'fund': {
        const funding = chainTx({
          inputs: [externalInput(10, this.#fundings++)],
          outputs: Array.from({ length: op.outputs }, () => output(WALLET_ADDRESS, 10_000_000n)),
        });
        return this.#rollForward(this.slot() + 1, [funding]);
      }
      case 'empty':
        return this.#rollForward(this.slot() + op.slots, []);
      case 'submit': {
        const offered = this.wallet.utxos();
        if (offered.length === 0) {
          return;
        }
        const spent = offered[op.pick % offered.length].input();
        const ttl = this.slot() + op.ttl;
        const spec: TxSpec = {
          inputs: [{ txId: spent.transactionId(), index: Number(spent.index()) }],
          outputs: [output(SOMEONE_ELSE), output(WALLET_ADDRESS)],
          ttl,
        };
        const submitted = chainTx(spec);
        const input = `${spent.transactionId()}#${spent.index()}`;
        const landing: Block = { slot: this.slot() + 1, txs: [submitted] };
        const landsInFlight =
          op.landsInFlight &&
          op.outcome !== 'rejected' &&
          landing.slot < ttl &&
          this.confirmed().has(input);
        this.#submitResult = SUBMIT_RESULTS[op.outcome];
        this.#inFlight = landsInFlight ? landing : null;
        // Signing adds a witness to the transaction it is given, so each wallet gets its own.
        await this.wallet.signAndSubmitTx(tx(spec));
        await this.twin.signAndSubmitTx(tx(spec));
        this.#inFlight = null;
        if (landsInFlight) {
          this.blocks.push(landing);
        }
        this.submissions.push({
          ...submitted,
          inputs: [input],
          change: `${submitted.id}#1`,
          ttl,
          accepted: op.outcome === 'ok',
          mayBeInMempool: op.outcome !== 'rejected',
        });
        return;
      }
      case 'land': {
        const slot = this.slot() + 1;
        const confirmed = this.confirmed();
        const landable = this.submissions.filter(
          (s) =>
            s.mayBeInMempool &&
            !this.landed(s) &&
            slot < s.ttl &&
            s.inputs.every((input) => confirmed.has(input)),
        );
        if (landable.length === 0) {
          return;
        }
        return this.#rollForward(slot, [landable[op.pick % landable.length]]);
      }
      case 'rollback': {
        const depth = Math.min(op.depth, this.blocks.length);
        if (depth === 0) {
          return;
        }
        this.blocks.splice(-depth);
        for (const wallet of [this.wallet, this.twin]) {
          await wallet.onRollBackward(header(this.slot()));
        }
        return;
      }
      case 'reload':
        this.wallet = reload(this.wallet, this.#walletSubmit);
        return;
    }
  }

  async #rollForward(slot: number, txs: ChainTx[]): Promise<void> {
    this.blocks.push({ slot, txs });
    for (const wallet of [this.wallet, this.twin]) {
      await wallet.onRollForward(
        header(slot),
        txs.map((t) => tx(t.spec)),
      );
    }
  }
}

/** Runs random operations against a funded wallet, checking `invariant` after each one. */
const holdsThroughout = (invariant: (world: World) => void) =>
  fc.assert(
    // Without `size: 'max'` fast-check keeps most sequences under ten operations.
    fc.asyncProperty(fc.array(op, { maxLength: 40, size: 'max' }), async (ops) => {
      const world = new World();
      await world.apply({ kind: 'fund', outputs: 3 });
      for (const next of ops) {
        await world.apply(next);
        invariant(world);
      }
    }),
    { numRuns: 200 },
  );

describe('CardanoWalletService under random chain activity', { timeout: 60_000 }, () => {
  it('holds the lovelace of the surviving chain, whatever was rolled back', () =>
    holdsThroughout((world) => {
      const expected = [...world.confirmed().values()].reduce((sum, coins) => sum + coins, 0n);
      expect(world.wallet.lovelace()).toBe(expected);
    }));

  it('never offers an input of a transaction that landed or may still land', () =>
    holdsThroughout((world) => {
      const offered = new Set(refs(world.wallet));
      for (const submission of world.submissions) {
        const spendsItsInputs =
          submission.mayBeInMempool && (world.landed(submission) || world.slot() < submission.ttl);
        if (spendsItsInputs) {
          expect(submission.inputs.filter((input) => offered.has(input))).toEqual([]);
        }
      }
    }));

  it('offers only outputs that exist or that a pending transaction can still create', () =>
    holdsThroughout((world) => {
      expect(refs(world.wallet).filter((ref) => !world.canExist(ref))).toEqual([]);
    }));

  // Loading may hide change the twin still offers: see the pending outputs `saveState` skips.
  it('offers nothing more, and holds the same, after its state is saved and loaded', () =>
    holdsThroughout((world) => {
      const twinOffers = new Set(refs(world.twin));
      expect(refs(world.wallet).filter((ref) => !twinOffers.has(ref))).toEqual([]);
      expect(world.wallet.lovelace()).toBe(world.twin.lovelace());
    }));
});
