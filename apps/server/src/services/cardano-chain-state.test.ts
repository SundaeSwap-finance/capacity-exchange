import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pino from 'pino';

const { mockReadTip, mockReadParams, mockFollowTip, mockCreateTransport } = vi.hoisted(() => ({
  mockReadTip: vi.fn(),
  mockReadParams: vi.fn(),
  mockFollowTip: vi.fn(),
  mockCreateTransport: vi.fn(() => ({})),
}));
vi.mock('@connectrpc/connect-node', () => ({ createGrpcTransport: mockCreateTransport }));
vi.mock('@connectrpc/connect', () => ({
  createPromiseClient: (service: { typeName: string }) =>
    service.typeName.endsWith('QueryService')
      ? { readParams: mockReadParams }
      : { readTip: mockReadTip, followTip: mockFollowTip },
}));

import { CardanoChainStateService, toBigInt } from './cardano-chain-state.js';

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
        minFeeCoefficient: int(44n),
        minFeeConstant: int(155381n),
        coinsPerUtxoByte: int(4310n),
        maxTxSize: 16384n,
        prices: {
          memory: { numerator: 577, denominator: 10000 },
          steps: { numerator: 721, denominator: 10000000 },
        },
      },
    },
  },
};

const tipResponse = (slot: number, timestamp = Date.now()) => ({
  tip: { slot: BigInt(slot), hash: hash(slot), timestamp: BigInt(timestamp) },
});

function block(slot: number, timestamp = Date.now()) {
  return {
    chain: {
      case: 'cardano',
      value: { header: { slot: BigInt(slot), hash: hash(slot) }, timestamp: BigInt(timestamp) },
    },
    nativeBytes: new Uint8Array(),
  };
}
const apply = (slot: number) => ({ action: { case: 'apply', value: block(slot) } });
const undo = (slot: number) => ({ action: { case: 'undo', value: block(slot) } });
const reset = (slot: number) => ({
  action: { case: 'reset', value: { slot: BigInt(slot), hash: hash(slot) } },
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
    svc = new CardanoChainStateService('http://dolos.test', logger as never);
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
      minFeeCoefficient: 44n,
      minFeeConstant: 155381n,
      coinsPerUtxoByte: 4310n,
      maxTxSize: 16384n,
      prices: {
        memory: { numerator: 577n, denominator: 10000n },
        steps: { numerator: 721n, denominator: 10000000n },
      },
    });

    const next = structuredClone(PARAMS_RESPONSE);
    next.values.params.value.minFeeConstant = int(200000n);
    mockReadParams.mockResolvedValue(next);

    expect((await s.protocolParams()).minFeeConstant).toBe(200000n);
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

  it('starts again from the source tip when no recent block intersects', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const s = await started();
    streams[0].push(apply(101), apply(102));
    await vi.waitFor(() => expect(s.tip().slot).toBe(102n));
    mockReadTip.mockResolvedValue(tipResponse(500));

    streams[0].push(notFound());
    await vi.waitFor(() => expect(s.health()).toMatchObject({ status: 'ko', error: /not_found/ }));
    await vi.advanceTimersByTimeAsync(5_000);

    await vi.waitFor(() => expect(streams).toHaveLength(2));
    expect(mockReadTip).toHaveBeenCalledTimes(2);
    expect(intersectSlots(1)).toEqual([500n]);
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
    svc = new CardanoChainStateService('http://dolos.test', logger as never);
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

describe('toBigInt', () => {
  it('reads an int64, an unsigned bignum and a negative bignum', () => {
    expect(toBigInt(int(5n) as never, 'f')).toBe(5n);
    expect(
      toBigInt({ bigInt: { case: 'bigUInt', value: Uint8Array.of(1, 0) } } as never, 'f'),
    ).toBe(256n);
    expect(toBigInt({ bigInt: { case: 'bigNInt', value: Uint8Array.of(0) } } as never, 'f')).toBe(
      -1n,
    );
  });

  it('throws when the field is missing', () => {
    expect(() => toBigInt(undefined, 'minFeeConstant')).toThrow(/missing minFeeConstant/);
  });
});
