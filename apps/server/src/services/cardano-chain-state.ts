import { FastifyBaseLogger } from 'fastify';
import { CardanoQueryClient, CardanoSyncClient } from '@utxorpc/sdk';
import type { Static } from '@sinclair/typebox';
import type { ChainHealth, ChainStatus } from '../models/health.js';

const PARAMS_POLL_INTERVAL_MS = 60_000;
const RPC_TIMEOUT_MS = 10_000;
const RECONNECT_DELAY_MS = 5_000;
// Blocks arrive every ~20 s on average (active slot coefficient 0.05, 1 s
// slots), so a tip this old means the source has stopped keeping up.
const MAX_TIP_AGE_MS = 5 * 60_000;
// A rollback never goes deeper than the security parameter k (2160 on mainnet).
const MAX_ROLLBACK_BLOCKS = 2160;
// Several points let a reconnect intersect even if the newest one was rolled
// back while the stream was down.
const INTERSECT_POINTS = 10;

type SyncInner = CardanoSyncClient['inner'];
type BlockRef = NonNullable<Awaited<ReturnType<SyncInner['readTip']>>['tip']>;
type FollowTipResponse =
  ReturnType<SyncInner['followTip']> extends AsyncIterable<infer R> ? R : never;
type TipAction = FollowTipResponse['action'];
type PParams = Awaited<ReturnType<CardanoQueryClient['readParams']>>;
type U5cBigInt = NonNullable<PParams['minFeeConstant']>;

export interface CardanoTip {
  slot: bigint;
  /** Block hash, hex. */
  hash: string;
  timestamp: Date;
}

export interface Rational {
  numerator: bigint;
  denominator: bigint;
}

/** The protocol parameters needed to price and size a Cardano transaction. */
export interface CardanoProtocolParams {
  minFeeCoefficient: bigint;
  minFeeConstant: bigint;
  coinsPerUtxoByte: bigint;
  maxTxSize: bigint;
  prices: { memory: Rational; steps: Rational };
}

/**
 * Follows the Cardano tip over UTxO RPC and caches the protocol parameters.
 * The FollowTip stream is the source of truth for the tip: ReadTip only seeds
 * where the stream starts, because Dolos serves it from state that can lag.
 */
export class CardanoChainStateService implements ChainHealth {
  private readonly query: CardanoQueryClient;
  private readonly sync: CardanoSyncClient;
  private readonly logger: FastifyBaseLogger;
  // Applied blocks, oldest first, so an undo can step back to the one before.
  private recent: CardanoTip[] = [];
  private params: CardanoProtocolParams | null = null;
  private streamError: string | null = null;
  private readonly abort = new AbortController();
  private following?: Promise<void>;
  private paramsTimer?: ReturnType<typeof setInterval>;

  constructor(url: string, logger: FastifyBaseLogger) {
    this.query = new CardanoQueryClient({ uri: url });
    this.sync = new CardanoSyncClient({ uri: url });
    this.logger = logger;
  }

  /** Primes the tip and protocol params, then follows the tip in the background. Throws if either read fails. */
  async start(): Promise<void> {
    const [tip] = await Promise.all([this.readTip(), this.refreshParams()]);
    this.recent = [tip];
    this.following = this.follow();
    this.paramsTimer = setInterval(() => {
      this.refreshParams().catch((err) => {
        this.logger.warn(
          { err },
          'CardanoChainStateService params refresh failed; keeping last known value',
        );
      });
    }, PARAMS_POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    clearInterval(this.paramsTimer);
    this.paramsTimer = undefined;
    this.abort.abort();
    await this.following;
  }

  tip(): CardanoTip {
    const tip = this.recent.at(-1);
    if (!tip) {
      throw new Error('CardanoChainStateService has no tip: not started, or rolled back past it');
    }
    return tip;
  }

  protocolParams(): CardanoProtocolParams {
    if (!this.params) {
      throw new Error('CardanoChainStateService not started: prime protocolParams before use');
    }
    return this.params;
  }

  health(): Static<typeof ChainStatus> {
    const tip = this.recent.at(-1);
    if (!tip) {
      return this.streamError ? { status: 'ko', error: this.streamError } : { status: 'syncing' };
    }
    const position = { slot: Number(tip.slot), tipAgeMs: Date.now() - tip.timestamp.getTime() };
    if (this.streamError) {
      return { status: 'ko', error: this.streamError, ...position };
    }
    return { status: position.tipAgeMs > MAX_TIP_AGE_MS ? 'syncing' : 'ok', ...position };
  }

  private async follow(): Promise<void> {
    const signal = this.abort.signal;
    while (!signal.aborted) {
      try {
        const intersect = this.recent.length
          ? this.recent.slice(-INTERSECT_POINTS).reverse()
          : [await this.readTip()];
        const stream = this.sync.inner.followTip(
          { intersect: intersect.map(toBlockRef) },
          { signal },
        );
        for await (const response of stream) {
          this.streamError = null;
          this.onAction(response.action);
        }
        throw new Error('FollowTip stream ended');
      } catch (err) {
        if (signal.aborted) {
          return;
        }
        this.streamError = String(err);
        this.logger.warn(
          { err },
          'CardanoChainStateService lost the FollowTip stream; reconnecting',
        );
        await pause(RECONNECT_DELAY_MS, signal);
      }
    }
  }

  private onAction(action: TipAction): void {
    switch (action.case) {
      case 'apply': {
        this.recent.push(blockTip(action.value));
        if (this.recent.length > MAX_ROLLBACK_BLOCKS) {
          this.recent.shift();
        }
        return;
      }
      case 'undo': {
        const undone = blockTip(action.value);
        const at = lastIndexOfHash(this.recent, undone.hash);
        // An undo past the oldest tracked block leaves no tip until the next apply.
        this.recent = at >= 0 ? this.recent.slice(0, at) : [];
        this.logger.info({ slot: undone.slot.toString() }, 'Cardano rollback: block undone');
        return;
      }
      case 'reset': {
        // The stream opens with a reset to the intersection it found.
        const hash = toHex(action.value.hash);
        const at = lastIndexOfHash(this.recent, hash);
        this.recent = at >= 0 ? this.recent.slice(0, at + 1) : [];
        return;
      }
    }
  }

  private async readTip(): Promise<CardanoTip> {
    const { tip } = await this.sync.inner.readTip(
      {},
      { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) },
    );
    if (!tip) {
      throw new Error('UTxO RPC ReadTip returned no tip');
    }
    return { slot: tip.slot, hash: toHex(tip.hash), timestamp: new Date(Number(tip.timestamp)) };
  }

  private async refreshParams(): Promise<void> {
    const { values } = await this.query.inner.readParams(
      {},
      { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) },
    );
    if (values?.params.case !== 'cardano') {
      throw new Error('UTxO RPC ReadParams returned no Cardano params');
    }
    this.params = toProtocolParams(values.params.value);
  }
}

type AnyChainBlock = Extract<TipAction, { case: 'apply' }>['value'];

function blockTip(block: AnyChainBlock): CardanoTip {
  const cardano = block.chain.case === 'cardano' ? block.chain.value : undefined;
  if (!cardano?.header) {
    throw new Error('UTxO RPC FollowTip sent a block with no Cardano header');
  }
  return {
    slot: cardano.header.slot,
    hash: toHex(cardano.header.hash),
    timestamp: new Date(Number(cardano.timestamp)),
  };
}

/** Resolves after `ms`, or as soon as `signal` aborts. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function lastIndexOfHash(tips: CardanoTip[], hash: string): number {
  for (let i = tips.length - 1; i >= 0; i--) {
    if (tips[i].hash === hash) {
      return i;
    }
  }
  return -1;
}

function toBlockRef(tip: CardanoTip): Partial<BlockRef> {
  return { slot: tip.slot, hash: Buffer.from(tip.hash, 'hex') };
}

export function toProtocolParams(p: PParams): CardanoProtocolParams {
  return {
    minFeeCoefficient: toBigInt(p.minFeeCoefficient, 'minFeeCoefficient'),
    minFeeConstant: toBigInt(p.minFeeConstant, 'minFeeConstant'),
    coinsPerUtxoByte: toBigInt(p.coinsPerUtxoByte, 'coinsPerUtxoByte'),
    maxTxSize: p.maxTxSize,
    prices: {
      memory: toRational(p.prices?.memory, 'prices.memory'),
      steps: toRational(p.prices?.steps, 'prices.steps'),
    },
  };
}

/** Decodes UTxO RPC's BigInt: an int64, or big-endian bytes for larger magnitudes. */
export function toBigInt(value: U5cBigInt | undefined, field: string): bigint {
  const big = value?.bigInt;
  switch (big?.case) {
    case 'int':
      return big.value;
    case 'bigUInt':
      return bytesToBigInt(big.value);
    case 'bigNInt':
      // CBOR negative bignums encode -1 - n.
      return -1n - bytesToBigInt(big.value);
    default:
      throw new Error(`UTxO RPC protocol params are missing ${field}`);
  }
}

function toRational(
  value: { numerator: number; denominator: number } | undefined,
  field: string,
): Rational {
  if (!value) {
    throw new Error(`UTxO RPC protocol params are missing ${field}`);
  }
  return { numerator: BigInt(value.numerator), denominator: BigInt(value.denominator) };
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  return bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}
