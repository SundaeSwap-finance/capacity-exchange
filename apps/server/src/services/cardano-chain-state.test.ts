import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pino from 'pino';

const { mockReadTip, mockReadParams, mockFollowTip } = vi.hoisted(() => ({
  mockReadTip: vi.fn(),
  mockReadParams: vi.fn(),
  mockFollowTip: vi.fn(),
}));
vi.mock('@utxorpc/sdk', () => ({
  CardanoQueryClient: class {
    inner = { readParams: mockReadParams };
  },
  CardanoSyncClient: class {
    inner = { readTip: mockReadTip, followTip: mockFollowTip };
  },
}));

import { CardanoChainStateService, toBigInt } from './cardano-chain-state.js';

const logger = pino({ level: 'silent' });

const hash = (byte: number) => new Uint8Array(32).fill(byte);
const hex = (byte: number) => Buffer.from(hash(byte)).toString('hex');
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

function block(slot: number, byte: number, timestamp = Date.now()) {
  return {
    chain: {
      case: 'cardano',
      value: { header: { slot: BigInt(slot), hash: hash(byte) }, timestamp: BigInt(timestamp) },
    },
    nativeBytes: new Uint8Array(),
  };
}
const apply = (slot: number, byte: number, timestamp?: number) => ({
  action: { case: 'apply', value: block(slot, byte, timestamp) },
});
const undo = (slot: number, byte: number) => ({
  action: { case: 'undo', value: block(slot, byte) },
});
const reset = (slot: number, byte: number) => ({
  action: { case: 'reset', value: { slot: BigInt(slot), hash: hash(byte) } },
});

/** A FollowTip stream the test feeds; it ends with an error when the caller aborts. */
class FakeStream {
  private queue: unknown[] = [];
  private wake: (() => void) | null = null;

  push(item: unknown) {
    this.queue.push(item);
    this.wake?.();
  }

  async *iterate(signal: AbortSignal) {
    while (true) {
      if (signal.aborted) {
        throw new Error('[canceled] The operation was aborted.');
      }
      const next = this.queue.shift();
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
    mockReadTip.mockReset().mockResolvedValue({
      tip: { slot: 100n, hash: hash(100), timestamp: BigInt(Date.now()) },
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

  async function started() {
    svc = new CardanoChainStateService('http://dolos.test', logger as never);
    await svc.start();
    await vi.waitFor(() => expect(streams).toHaveLength(1));
    return svc;
  }

  it('primes the tip and protocol params on start', async () => {
    const s = await started();

    expect(s.tip()).toMatchObject({ slot: 100n, hash: hex(100) });
    expect(s.protocolParams()).toEqual({
      minFeeCoefficient: 44n,
      minFeeConstant: 155381n,
      coinsPerUtxoByte: 4310n,
      maxTxSize: 16384n,
      prices: {
        memory: { numerator: 577n, denominator: 10000n },
        steps: { numerator: 721n, denominator: 10000000n },
      },
    });
  });

  it('follows from the tip it read, and an apply moves the tip', async () => {
    const s = await started();
    const [request] = mockFollowTip.mock.calls[0];
    expect(request.intersect).toEqual([{ slot: 100n, hash: Buffer.from(hash(100)) }]);

    streams[0].push(reset(100, 100));
    streams[0].push(apply(101, 101));

    await vi.waitFor(() => expect(s.tip().slot).toBe(101n));
    expect(s.health()).toMatchObject({ status: 'ok', slot: 101 });
  });

  it('an undo steps the tip back to the block before it', async () => {
    const s = await started();
    streams[0].push(apply(101, 101));
    streams[0].push(apply(102, 102));
    streams[0].push(undo(102, 102));

    await vi.waitFor(() => expect(s.tip().slot).toBe(101n));
  });

  it('a reset drops the blocks after the intersection', async () => {
    const s = await started();
    streams[0].push(apply(101, 101));
    streams[0].push(apply(102, 102));
    await vi.waitFor(() => expect(s.tip().slot).toBe(102n));

    streams[0].push(reset(101, 101));

    await vi.waitFor(() => expect(s.tip().slot).toBe(101n));
  });

  it('reports syncing while the tip is more than five minutes old', async () => {
    mockReadTip.mockResolvedValue({
      tip: { slot: 100n, hash: hash(100), timestamp: BigInt(Date.now() - 6 * 60_000) },
    });
    const s = await started();
    expect(s.health().status).toBe('syncing');

    streams[0].push(apply(101, 101));

    await vi.waitFor(() => expect(s.health().status).toBe('ok'));
  });

  it('reports ko when the stream fails, then reconnects from its recent blocks', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const s = await started();
    streams[0].push(apply(101, 101));
    streams[0].push(apply(102, 102));
    await vi.waitFor(() => expect(s.tip().slot).toBe(102n));

    streams[0].push(new Error('connection reset'));
    await vi.waitFor(() => expect(s.health()).toMatchObject({ status: 'ko', slot: 102 }));

    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => expect(streams).toHaveLength(2));
    const [request] = mockFollowTip.mock.calls[1];
    expect(request.intersect.map((ref: { slot: bigint }) => ref.slot)).toEqual([102n, 101n, 100n]);

    streams[1].push(reset(102, 102));
    await vi.waitFor(() => expect(s.health().status).toBe('ok'));
  });

  it('stop ends the stream without reconnecting', async () => {
    const s = await started();
    await s.stop();
    svc = undefined;

    expect(mockFollowTip).toHaveBeenCalledTimes(1);
  });

  it('throws on start when ReadParams has no Cardano params', async () => {
    mockReadParams.mockResolvedValue({ values: undefined });
    svc = new CardanoChainStateService('http://dolos.test', logger as never);

    await expect(svc.start()).rejects.toThrow(/no Cardano params/);
    svc = undefined;
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
