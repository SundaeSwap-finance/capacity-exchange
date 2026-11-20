import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pino from 'pino';

const {
  mockReadTip,
  mockFetchBlock,
  mockReadParams,
  mockFollowTip,
  mockSubmitTx,
  mockCreateTransport,
} = vi.hoisted(() => ({
  mockReadTip: vi.fn(),
  mockFetchBlock: vi.fn(),
  mockReadParams: vi.fn(),
  mockFollowTip: vi.fn(),
  mockSubmitTx: vi.fn(),
  mockCreateTransport: vi.fn(() => ({})),
}));
vi.mock('@connectrpc/connect-node', () => ({ createGrpcTransport: mockCreateTransport }));
vi.mock('@connectrpc/connect', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@connectrpc/connect')>()),
  createClient: (service: { typeName: string }) =>
    service.typeName.endsWith('QueryService')
      ? { readParams: mockReadParams }
      : service.typeName.endsWith('SubmitService')
        ? { submitTx: mockSubmitTx }
        : { readTip: mockReadTip, fetchBlock: mockFetchBlock, followTip: mockFollowTip },
}));
// Test blocks carry no CBOR, so every one parses as an empty block.
vi.mock('@capacity-exchange/cardano-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacity-exchange/cardano-core')>()),
  parseBlock: () => [{}, []],
}));

import { Code, ConnectError } from '@connectrpc/connect';
import { CardanoChainStateService, fromU5CBigInt } from './chain-state.js';
import {
  BlockId,
  Slot,
  type CborReader,
  type CborWriter,
  type Point,
  type Transaction,
} from '@capacity-exchange/cardano-core';
import { InMemoryStateStore } from './store.js';

const logger = pino({ level: 'silent' });

/** Each test block's hash is its slot, so every slot has a distinct block. */
function hash(slot: number) {
  const bytes = new Uint8Array(32);
  new DataView(bytes.buffer).setUint32(28, slot);
  return bytes;
}
const hex = (slot: number) => Buffer.from(hash(slot)).toString('hex');
const int = (value: bigint) => ({ bigInt: { case: 'int', value } });

const PARAMS_RESPONSE = {
  values: {
    params: {
      case: 'cardano',
      value: {
        coinsPerUtxoByte: int(4310n),
        maxTxSize: 16384n,
        maxValueSize: 5000n,
        minFeeCoefficient: int(44n),
        minFeeConstant: int(155381n),
        prices: {
          memory: { numerator: 577, denominator: 10000 },
          steps: { numerator: 721, denominator: 10000000 },
        },
        minFeeScriptRefCostPerByte: { numerator: 15, denominator: 1 },
      },
    },
  },
};

const tipResponse = (slot: number, timestamp = Date.now()) => ({
  tip: { slot: BigInt(slot), height: BigInt(slot), hash: hash(slot), timestamp: BigInt(timestamp) },
});

function block(slot: number, timestamp = Date.now()) {
  return {
    chain: {
      case: 'cardano',
      value: {
        header: { slot: BigInt(slot), height: BigInt(slot), hash: hash(slot) },
        timestamp: BigInt(timestamp),
      },
    },
    nativeBytes: new Uint8Array(),
  };
}
const apply = (slot: number) => ({ action: { case: 'apply', value: block(slot) } });
const undo = (slot: number) => ({ action: { case: 'undo', value: block(slot) } });
const reset = (slot: number, timestamp = Date.now()) => ({
  action: {
    case: 'reset',
    value: {
      slot: BigInt(slot),
      height: BigInt(slot),
      hash: hash(slot),
      timestamp: BigInt(timestamp),
    },
  },
});
const notFound = () =>
  Object.assign(new Error('[not_found] none of the requested points intersect'), { code: 5 });

const END = Symbol('end');

/** A FollowTip stream the test feeds. It fails when the caller aborts, as the real one does. */
class FakeStream {
  private queue: unknown[] = [];
  private wake: (() => void) | null = null;
  /** Set once the reader stops consuming the stream, for any reason. */
  closed = false;

  push(...items: unknown[]) {
    this.queue.push(...items);
    this.wake?.();
  }

  end() {
    this.push(END);
  }

  async *iterate(signal: AbortSignal) {
    try {
      yield* this.read(signal);
    } finally {
      this.closed = true;
    }
  }

  private async *read(signal: AbortSignal) {
    while (true) {
      if (signal.aborted) {
        throw new Error('[canceled] The operation was aborted.');
      }
      const next = this.queue.shift();
      if (next === END) {
        return;
      }
      if (next instanceof Error) {
        throw next;
      }
      if (next) {
        yield next;
        continue;
      }
      await new Promise<void>((resolve) => {
        this.wake = resolve;
        signal.addEventListener('abort', () => resolve(), { once: true });
      });
    }
  }
}

describe('CardanoChainStateService', () => {
  let svc: CardanoChainStateService | undefined;
  let streams: FakeStream[];

  beforeEach(() => {
    streams = [];
    mockReadTip.mockReset().mockResolvedValue(tipResponse(100));
    mockFetchBlock.mockReset().mockImplementation((req) => {
      const blocks = req.ref.map((r: any) => block(Number(r.slot)));
      return Promise.resolve({ block: blocks });
    });
    mockReadParams.mockReset().mockResolvedValue(PARAMS_RESPONSE);
    mockFollowTip.mockReset().mockImplementation((_req, { signal }) => {
      const stream = new FakeStream();
      streams.push(stream);
      return stream.iterate(signal);
    });
  });

  afterEach(async () => {
    await svc?.stop();
    svc = undefined;
    vi.useRealTimers();
  });

  async function started(expectedStreams = 1) {
    svc = new CardanoChainStateService({
      url: 'http://dolos.test',
      networkId: 'preview',
      store: new InMemoryStateStore(),
      logger: logger as never,
    });
    svc.start();
    await vi.waitFor(() => expect(streams).toHaveLength(expectedStreams));
    return svc;
  }

  const intersectSlots = (call: number) =>
    mockFollowTip.mock.calls[call][0].intersect.map((ref: { slot: bigint }) => ref.slot);

  it('follows from the tip it read', async () => {
    const s = await started();

    expect(s.tip()).toMatchObject({ slot: 100n, hash: hex(100) });
    expect(mockFollowTip.mock.calls[0][0].intersect).toEqual([
      { slot: 100n, hash: Buffer.from(hash(100)) },
    ]);
  });

  it('reads the protocol params from the source on each call', async () => {
    const s = await started();

    expect(await s.protocolParams()).toEqual({
      coinsPerUtxoByte: 4310,
      maxTxSize: 16384,
      maxValueSize: 5000,
      minFeeCoefficient: 44,
      minFeeConstant: 155381,
      prices: {
        memory: 0.0577,
        steps: 0.0000721,
      },
      minFeeRefScriptCostPerByte: '15',
    });

    const next = structuredClone(PARAMS_RESPONSE);
    next.values.params.value.minFeeConstant = int(200000n);
    mockReadParams.mockResolvedValue(next);

    expect((await s.protocolParams()).minFeeConstant).toBe(200000);
    expect(mockReadParams).toHaveBeenCalledTimes(2);
  });

  it('rejects protocolParams when ReadParams has no Cardano params', async () => {
    const s = await started();
    mockReadParams.mockResolvedValue({ values: undefined });

    await expect(s.protocolParams()).rejects.toThrow(/no Cardano params/);
  });

  it('connects with HTTP/2 pings, so a dead connection is closed instead of reused', async () => {
    await started();

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'http://dolos.test',
        httpVersion: '2',
        pingIntervalMs: expect.any(Number),
        pingTimeoutMs: expect.any(Number),
      }),
    );
  });

  it('an apply moves the tip', async () => {
    const s = await started();
    streams[0].push(reset(100), apply(101));

    await vi.waitFor(() => expect(s.tip().slot).toBe(101n));
    expect(s.health()).toMatchObject({ status: 'ok', slot: 101 });
  });

  it('undos step the tip back one block at a time', async () => {
    const s = await started();
    streams[0].push(apply(101), apply(102), apply(103), undo(103), undo(102));

    await vi.waitFor(() => expect(s.tip().slot).toBe(101n));
  });

  it('an undo of an older block drops it and everything after it', async () => {
    const s = await started();
    streams[0].push(apply(101), apply(102), apply(103), undo(102));

    await vi.waitFor(() => expect(s.tip().slot).toBe(101n));
  });

  it('keeps a tip after a rollback of the full 2160 blocks', async () => {
    const s = await started();
    for (let slot = 101; slot <= 2300; slot++) {
      streams[0].push(apply(slot));
    }
    await vi.waitFor(() => expect(s.tip().slot).toBe(2300n));

    for (let slot = 2300; slot > 2300 - 2160; slot--) {
      streams[0].push(undo(slot));
    }

    await vi.waitFor(() => expect(s.tip().slot).toBe(140n));
  });

  it('stops following after a rollback deeper than 2160 blocks', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const s = await started();
    for (let slot = 101; slot <= 2300; slot++) {
      streams[0].push(apply(slot));
    }
    await vi.waitFor(() => expect(s.tip().slot).toBe(2300n));

    // The window keeps 2161 blocks, 140..2300: the 2161st undo, of 140, is one too deep.
    for (let slot = 2300; slot >= 140; slot--) {
      streams[0].push(undo(slot));
    }

    await vi.waitFor(() =>
      expect(s.health()).toMatchObject({ status: 'ko', error: /rolled back 2161 blocks/ }),
    );
    expect(s.tip().slot).toBe(140n);
    expect(streams[0].closed).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(streams).toHaveLength(1);
  });

  it('counts a reset to an older tracked block towards the rollback depth', async () => {
    const s = await started();
    for (let slot = 101; slot <= 2300; slot++) {
      streams[0].push(apply(slot));
    }
    await vi.waitFor(() => expect(s.tip().slot).toBe(2300n));

    streams[0].push(reset(140));
    await vi.waitFor(() => expect(s.tip().slot).toBe(140n));
    streams[0].push(undo(140));

    await vi.waitFor(() =>
      expect(s.health()).toMatchObject({ status: 'ko', error: /rolled back 2161 blocks/ }),
    );
  });

  it('counts the rollback depth from the last apply', async () => {
    const s = await started();
    for (let slot = 101; slot <= 2300; slot++) {
      streams[0].push(apply(slot));
    }
    await vi.waitFor(() => expect(s.tip().slot).toBe(2300n));

    // 1500 undos, an apply, then 661 more: 2161 in all, but at most 1500 in a row.
    for (let slot = 2300; slot > 800; slot--) {
      streams[0].push(undo(slot));
    }
    streams[0].push(apply(801));
    for (let slot = 801; slot > 140; slot--) {
      streams[0].push(undo(slot));
    }
    streams[0].push(apply(141));

    await vi.waitFor(() => expect(s.tip().slot).toBe(141n));
    expect(s.health().status).toBe('ok');
  });

  it('resets quietly when a rollback passes a window that has not filled yet', async () => {
    const s = await started();
    streams[0].push(undo(100), undo(99));
    await vi.waitFor(() => expect(() => s.tip()).toThrow(/no tip/));
    expect(s.health()).toEqual({ status: 'syncing' });

    streams[0].push(apply(99));

    await vi.waitFor(() => expect(s.tip().slot).toBe(99n));
    expect(s.health().status).toBe('ok');
  });

  it('a reset drops the blocks after the intersection', async () => {
    const s = await started();
    streams[0].push(apply(101), apply(102));
    await vi.waitFor(() => expect(s.tip().slot).toBe(102n));

    streams[0].push(reset(101));

    await vi.waitFor(() => expect(s.tip().slot).toBe(101n));
  });

  describe('followers', () => {
    const header = (slot: number) => ({ blockNo: slot, slot, hash: hex(slot) });

    async function followed(
      startingPoint?: Point,
      store = new InMemoryStateStore(),
      name = 'mock',
    ) {
      const follower = {
        followerName: () => name,
        initState: vi.fn(),
        saveState: vi.fn((writer: CborWriter) => writer.writeInt(0)),
        loadState: vi.fn((reader: CborReader) => reader.readInt()),
        onRollForward: vi.fn(),
        onRollBackward: vi.fn(),
      };
      svc = new CardanoChainStateService({
        url: 'http://dolos.test',
        networkId: 'preview',
        store,
        logger: logger as never,
      });
      svc.addFollower(follower);
      const before = streams.length;
      svc.start(startingPoint);
      await vi.waitFor(() => expect(streams).toHaveLength(before + 1));
      return { s: svc, follower };
    }

    it('rolls followers back to the block before an undone one', async () => {
      const { s, follower } = await followed();
      streams[0].push(apply(101), apply(102), undo(102));
      await vi.waitFor(() => expect(s.tip().slot).toBe(101n));

      expect(follower.onRollBackward).toHaveBeenCalledExactlyOnceWith(header(101));
    });

    it('rolls followers back one block per undo', async () => {
      const { s, follower } = await followed();
      streams[0].push(apply(101), apply(102), undo(102), undo(101));

      await vi.waitFor(() =>
        expect(follower.onRollBackward.mock.calls).toEqual([[header(101)], [header(100)]]),
      );
      expect(s.tip().slot).toBe(100n);
    });

    it('rolls followers back to the block a reset names', async () => {
      const { s, follower } = await followed();
      streams[0].push(apply(101), apply(102), reset(101));
      await vi.waitFor(() => expect(s.tip().slot).toBe(101n));

      expect(follower.onRollBackward).toHaveBeenCalledExactlyOnceWith(header(101));
    });

    it('rolls followers back to the starting point when its first block is undone', async () => {
      const { s, follower } = await followed({ slot: Slot(90), hash: BlockId(hex(90)) });
      expect(intersectSlots(0)).toEqual([90n]);
      expect(mockReadTip).not.toHaveBeenCalled();
      streams[0].push(reset(90), apply(91), undo(91));

      await vi.waitFor(() =>
        expect(follower.onRollBackward.mock.calls).toEqual([[header(90)], [header(90)]]),
      );
      expect(s.tip()).toMatchObject({ slot: 90n, hash: hex(90) });
    });

    it('stops following when no recent block intersects once followers hold state', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { s } = await followed();
      streams[0].push(apply(101));
      await vi.waitFor(() => expect(s.tip().slot).toBe(101n));

      streams[0].push(notFound());
      await vi.waitFor(() =>
        expect(s.health()).toMatchObject({ status: 'ko', error: /common block/ }),
      );
      await vi.advanceTimersByTimeAsync(5_000);

      expect(streams).toHaveLength(1);
      expect(mockReadTip).toHaveBeenCalledTimes(1);
    });

    it('reconnects from an older tracked block and rolls followers back to it', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { s, follower } = await followed();
      for (let slot = 101; slot <= 140; slot++) {
        streams[0].push(apply(slot));
      }
      await vi.waitFor(() => expect(s.tip().slot).toBe(140n));

      streams[0].push(new Error('connection reset'));
      await vi.waitFor(() => expect(s.health()).toMatchObject({ status: 'ko' }));
      await vi.advanceTimersByTimeAsync(5_000);
      await vi.waitFor(() => expect(streams).toHaveLength(2));
      // The newest ten, then doubling gaps, then the oldest tracked block.
      expect(intersectSlots(1)).toEqual([
        140n,
        139n,
        138n,
        137n,
        136n,
        135n,
        134n,
        133n,
        132n,
        131n,
        129n,
        125n,
        117n,
        101n,
        100n,
      ]);

      streams[1].push(reset(117));

      await vi.waitFor(() => expect(s.tip().slot).toBe(117n));
      expect(follower.onRollBackward).toHaveBeenLastCalledWith(header(117));
      expect(s.health().status).toBe('ok');
    });

    it('retries a block a follower failed to apply until it succeeds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { s, follower } = await followed();
      streams[0].push(apply(101));
      await vi.waitFor(() => expect(s.tip().slot).toBe(101n));

      follower.onRollForward.mockRejectedValueOnce(new Error('follower failed'));
      streams[0].push(apply(102));
      await vi.waitFor(() => expect(s.health()).toMatchObject({ status: 'ko', slot: 101 }));
      expect(follower.onRollForward).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(5_000);
      await vi.waitFor(() => expect(streams).toHaveLength(2));
      // The failed block is not tracked, so the stream resumes from the one before it.
      expect(intersectSlots(1)).toEqual([101n, 100n]);

      streams[1].push(reset(101), apply(102));
      await vi.waitFor(() => expect(s.tip().slot).toBe(102n));
      // The reset undoes whatever the failed apply left behind before the retry.
      expect(follower.onRollBackward).toHaveBeenCalledExactlyOnceWith(header(101));
      expect(follower.onRollForward).toHaveBeenCalledTimes(3);
      expect(s.health().status).toBe('ok');
    });

    it('does not roll followers back for blocks they never saw', async () => {
      const { s, follower } = await followed();
      streams[0].push(undo(100), undo(99));
      await vi.waitFor(() => expect(() => s.tip()).toThrow(/no tip/));

      expect(follower.onRollBackward).not.toHaveBeenCalled();
    });

    describe('after a restart', () => {
      /** Runs a service on `store` until it has applied `slots`, then stops it. */
      async function runThenStop(store: InMemoryStateStore, slots: number[], name = 'mock') {
        const { s, follower } = await followed(undefined, store, name);
        follower.saveState.mockImplementation((writer) => writer.writeInt(BigInt(slots.at(-1)!)));
        streams.at(-1)!.push(...slots.map(apply));
        await vi.waitFor(() => expect(s.tip().slot).toBe(BigInt(slots.at(-1)!)));
        await s.stop();
        svc = undefined;
      }

      it('resumes from the saved blocks and hands followers their saved state', async () => {
        const store = new InMemoryStateStore();
        await runThenStop(store, [101, 102]);

        const { s, follower } = await followed(undefined, store);

        expect(intersectSlots(1)).toEqual([102n, 101n, 100n]);
        expect(follower.initState).not.toHaveBeenCalled();
        expect(follower.loadState).toHaveBeenCalledOnce();
        expect(follower.loadState.mock.results[0].value).toBe(102n);
        expect(s.tip()).toMatchObject({ slot: 102n, hash: hex(102) });
        expect(mockReadTip).toHaveBeenCalledTimes(1);
        expect(mockFetchBlock).not.toHaveBeenCalled();
      });

      it('keeps saving after resuming', async () => {
        const store = new InMemoryStateStore();
        await runThenStop(store, [101, 102]);
        await runThenStop(store, [103]);

        await followed(undefined, store);

        expect(intersectSlots(2)).toEqual([103n, 102n, 101n, 100n]);
        expect(mockReadTip).toHaveBeenCalledTimes(1);
      });

      it('stops on a saved chain the source does not have, rather than starting over', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const store = new InMemoryStateStore();
        await runThenStop(store, [101]);

        const { s } = await followed(undefined, store);
        streams[1].push(notFound());

        await vi.waitFor(() =>
          expect(s.health()).toMatchObject({ status: 'ko', error: /common block/ }),
        );
        await vi.advanceTimersByTimeAsync(5_000);
        expect(streams).toHaveLength(2);
      });

      it('ignores saved state from a different starting point', async () => {
        const store = new InMemoryStateStore();
        await runThenStop(store, [101, 102]);

        const { follower } = await followed({ slot: Slot(90), hash: BlockId(hex(90)) }, store);

        expect(intersectSlots(1)).toEqual([90n]);
        expect(follower.loadState).not.toHaveBeenCalled();
        expect(follower.initState).toHaveBeenCalledExactlyOnceWith(90);
      });

      it('syncs again from the saved start when a follower has no saved state', async () => {
        const store = new InMemoryStateStore();
        await runThenStop(store, [101, 102], 'old');

        const { follower } = await followed(undefined, store, 'new');

        // From the saved start (the first run's tip), not the source's tip now.
        expect(intersectSlots(1)).toEqual([100n]);
        expect(mockFetchBlock).toHaveBeenCalledOnce();
        expect(mockReadTip).toHaveBeenCalledTimes(1);
        expect(follower.initState).toHaveBeenCalledExactlyOnceWith(100);
      });
    });
  });

  it('reports syncing while the tip is more than five minutes old', async () => {
    mockReadTip.mockResolvedValue(tipResponse(100, Date.now() - 6 * 60_000));
    const s = await started();
    expect(s.health().status).toBe('syncing');

    streams[0].push(apply(101));

    await vi.waitFor(() => expect(s.health().status).toBe('ok'));
  });

  it('reports ko when the stream fails, then reconnects from its recent blocks', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const s = await started();
    streams[0].push(apply(101), apply(102));
    await vi.waitFor(() => expect(s.tip().slot).toBe(102n));

    streams[0].push(new Error('connection reset'));
    await vi.waitFor(() => expect(s.health()).toMatchObject({ status: 'ko', slot: 102 }));

    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => expect(streams).toHaveLength(2));
    expect(intersectSlots(1)).toEqual([102n, 101n, 100n]);

    streams[1].push(reset(102));
    await vi.waitFor(() => expect(s.health().status).toBe('ok'));
  });

  it('reconnects when the stream ends cleanly', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const s = await started();
    streams[0].push(apply(101));
    streams[0].end();
    await vi.waitFor(() => expect(s.health()).toMatchObject({ status: 'ko', error: /ended/ }));

    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => expect(streams).toHaveLength(2));
    expect(intersectSlots(1)).toEqual([101n, 100n]);
  });

  it('reconnects when a connection sends nothing after opening', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const s = await started();

    await vi.advanceTimersByTimeAsync(15_000);
    await vi.waitFor(() =>
      expect(s.health()).toMatchObject({ status: 'ko', error: /sent nothing/ }),
    );

    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => expect(streams).toHaveLength(2));
  });

  it('reconnects when an open stream goes silent', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const s = await started();
    streams[0].push(reset(100));
    await vi.waitFor(() => expect(s.health().status).toBe('ok'));

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await vi.waitFor(() =>
      expect(s.health()).toMatchObject({ status: 'ko', error: /went silent/ }),
    );

    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => expect(streams).toHaveLength(2));
  });

  it('does not throw on start when the source is down, and recovers when it returns', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockReadTip.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:50151'));
    svc = new CardanoChainStateService({
      url: 'http://dolos.test',
      networkId: 'preview',
      store: new InMemoryStateStore(),
      logger: logger as never,
    });
    svc.start();

    await vi.waitFor(() =>
      expect(svc!.health()).toMatchObject({ status: 'ko', error: /ECONNREFUSED/ }),
    );
    expect(mockFollowTip).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => expect(streams).toHaveLength(1));
    streams[0].push(reset(100));
    await vi.waitFor(() => expect(svc!.health().status).toBe('ok'));
  });

  it('stop ends the stream without reconnecting', async () => {
    const s = await started();
    await s.stop();
    svc = undefined;

    expect(mockFollowTip).toHaveBeenCalledTimes(1);
  });
});

describe('fromU5CBigInt', () => {
  it('reads an int64, an unsigned bignum and a negative bignum', () => {
    expect(fromU5CBigInt(int(5n) as never, 'f')).toBe(5n);
    expect(
      fromU5CBigInt({ bigInt: { case: 'bigUInt', value: Uint8Array.of(1, 0) } } as never, 'f'),
    ).toBe(256n);
    expect(
      fromU5CBigInt({ bigInt: { case: 'bigNInt', value: Uint8Array.of(0) } } as never, 'f'),
    ).toBe(-1n);
  });

  it('throws when the field is missing', () => {
    expect(() => fromU5CBigInt(undefined, 'minFeeConstant')).toThrow(/missing minFeeConstant/);
  });
});

describe('CardanoChainStateService.submit', () => {
  const tx = { toCbor: () => '84a0' } as unknown as Transaction;
  const service = () =>
    new CardanoChainStateService({
      url: 'http://dolos',
      networkId: 'preview',
      store: new InMemoryStateStore(),
      logger,
    });

  beforeEach(() => {
    mockSubmitTx.mockReset();
  });

  it('reports a submitted tx as in the mempool', async () => {
    mockSubmitTx.mockResolvedValue({});
    expect(await service().submit(tx)).toEqual({ status: 'ok', reachedMempool: true });
  });

  it('reports a tx the source refused as not in the mempool', async () => {
    mockSubmitTx.mockRejectedValue(new ConnectError('could not process tx', Code.InvalidArgument));
    expect(await service().submit(tx)).toEqual({
      status: 'error',
      reason: 'could not process tx',
      reachedMempool: false,
    });
  });

  it.each([Code.Unavailable, Code.Internal, Code.Unknown, Code.DeadlineExceeded, Code.Canceled])(
    'cannot tell whether the tx reached the mempool after code %i',
    async (code) => {
      mockSubmitTx.mockRejectedValue(new ConnectError('lost', code));
      const result = await service().submit(tx);
      expect(result).toEqual({ status: 'error', reason: 'lost' });
      expect(result).not.toHaveProperty('reachedMempool');
    },
  );

  it('cannot tell whether the tx reached the mempool after a non-RPC error', async () => {
    mockSubmitTx.mockRejectedValue(new Error('boom'));
    expect(await service().submit(tx)).not.toHaveProperty('reachedMempool');
  });
});
