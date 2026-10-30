import { FastifyBaseLogger } from 'fastify';
import { createClient, type Client } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { queryConnect, submitConnect, syncConnect, type cardano, type sync } from '@utxorpc/spec';
import type { Static } from '@sinclair/typebox';
import type { ChainHealth, ChainStatus } from '../../models/health.js';
import {
  BlockId,
  BlockNo,
  HexBlob,
  parseBlock,
  PartialBlockHeader,
  Point,
  ProtocolParameters,
  Slot,
  Transaction,
  TransactionId,
  TransactionOutput,
  TxIn,
  Utxo,
} from '@capacity-exchange/cardano-core';
import { MAX_ROLLBACK_DEPTH } from './utils.js';

const RPC_TIMEOUT_MS = 10_000;
const RECONNECT_DELAY_MS = 5_000;
// Blocks arrive every ~20 s on average (active slot coefficient 0.05, 1 s
// slots), so a tip this old means the source has stopped keeping up.
const MAX_TIP_AGE_MS = 5 * 60_000;
// One block more keeps a tip after a rollback of the full depth.
const TRACKED_BLOCKS = MAX_ROLLBACK_DEPTH + 1;
// Several points let a reconnect intersect even if the newest one was rolled
// back while the stream was down: this many newest blocks, then exponentially
// sparser ones back to the oldest tracked block, which followers can still undo to.
const DENSE_INTERSECT_POINTS = 10;
// Dolos opens every FollowTip stream with a reset, so silence this long after
// connecting means the connection was accepted but is not being served.
const FIRST_MESSAGE_TIMEOUT_MS = 15_000;
// Pings catch a dead connection; this catches a stream the source stops serving
// on a live one.
const STREAM_IDLE_TIMEOUT_MS = MAX_TIP_AGE_MS;
// Without pings a dead HTTP/2 connection is never noticed, and every retry is
// sent down it again.
const PING_INTERVAL_MS = 10_000;
const PING_TIMEOUT_MS = 5_000;
// The gRPC status Dolos returns when none of the intersect points is on its chain.
const GRPC_NOT_FOUND = 5;

type TipAction = sync.FollowTipResponse['action'];

export interface CardanoTip {
  slot: bigint;
  height: bigint;
  /** Block hash, hex. */
  hash: string;
  timestamp: Date;
}

export interface Rational {
  numerator: bigint;
  denominator: bigint;
}

/** The protocol parameters needed to price and size a Cardano transaction. */
export type CardanoProtocolParams = Pick<
  ProtocolParameters,
  | 'coinsPerUtxoByte'
  | 'maxTxSize'
  | 'maxValueSize'
  | 'minFeeCoefficient'
  | 'minFeeConstant'
  | 'prices'
  | 'minFeeRefScriptCostPerByte'
>;

export interface ChainFollower {
  onRollForward(header: PartialBlockHeader, txs: Transaction[]): Promise<void>;
  onRollBackward(header: PartialBlockHeader): Promise<void>;
}

export interface CardanoChainStateServiceArgs {
  url: string;
  startingPoint?: Point;
  logger: FastifyBaseLogger;
}

/**
 * Follows the Cardano tip and reads the protocol parameters over UTxO RPC.
 * The FollowTip stream is the source of truth for the tip: ReadTip only seeds
 * where the stream starts, because Dolos serves it from state that can lag.
 */
export class CardanoChainStateService implements ChainHealth {
  readonly #query: Client<typeof queryConnect.QueryService>;
  readonly #sync: Client<typeof syncConnect.SyncService>;
  readonly #submit: Client<typeof submitConnect.SubmitService>;
  private readonly logger: FastifyBaseLogger;
  private readonly followers: ChainFollower[] = [];
  // Applied blocks, oldest first, so an undo can step back to the one before.
  private recent: CardanoTip[] = [];
  private startingPoint?: Point;
  // Blocks rolled back since the last apply.
  private rollbackDepth = 0;
  // Set once a block reaches followers: from then on, starting again from another
  // point would leave their state out of step with the chain.
  private followersHoldState = false;
  private streamError: string | null = null;
  private readonly abort = new AbortController();
  private following?: Promise<void>;

  constructor({ url, startingPoint, logger }: CardanoChainStateServiceArgs) {
    const transport = createGrpcTransport({
      httpVersion: '2',
      baseUrl: url,
      pingIntervalMs: PING_INTERVAL_MS,
      pingTimeoutMs: PING_TIMEOUT_MS,
    });
    this.#query = createClient(queryConnect.QueryService, transport);
    this.#sync = createClient(syncConnect.SyncService, transport);
    this.#submit = createClient(submitConnect.SubmitService, transport);
    this.logger = logger;
    this.startingPoint = startingPoint;
  }

  addFollower(follower: ChainFollower) {
    if (this.following) {
      throw new Error('Cannot add followers after startup');
    }
    this.followers.push(follower);
  }

  /** Follows the tip; an unreachable source shows as `ko`. */
  start(): void {
    this.following = this.follow();
  }

  async stop(): Promise<void> {
    this.abort.abort();
    await this.following;
  }

  tip(): CardanoTip {
    const tip = this.recent.at(-1);
    if (!tip) {
      throw new Error(
        'CardanoChainStateService has no tip: the source has not answered, or rolled back past every tracked block',
      );
    }
    return tip;
  }

  /** Reads the protocol params on each call: they can change at an epoch boundary. */
  public async protocolParams(): Promise<CardanoProtocolParams> {
    const { values } = await this.#query.readParams(
      {},
      { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) },
    );
    if (values?.params.case !== 'cardano') {
      throw new Error('UTxO RPC ReadParams returned no Cardano params');
    }
    return toProtocolParams(values.params.value);
  }

  public async resolveInputs(inputs: TxIn[]): Promise<Utxo[]> {
    if (!inputs.length) {
      return [];
    }
    const keys = inputs.map((input) => ({
      hash: Buffer.from(input.txId, 'hex'),
      index: input.index,
    }));
    const response = await this.#query.readUtxos(
      { keys },
      { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) },
    );
    return response.items.flatMap((utxo) => {
      const txoRef = utxo.txoRef;
      if (!txoRef) {
        throw new Error('Server did not populate txoRef');
      }
      const txIn: TxIn = {
        txId: TransactionId.fromHexBlob(HexBlob.fromBytes(txoRef.hash)),
        index: txoRef.index,
      };
      const txo = TransactionOutput.fromCbor(HexBlob.fromBytes(utxo.nativeBytes)).toCore();
      return [[txIn as Utxo[0], txo]];
    });
  }

  public async submit(tx: Transaction) {
    const cbor = Buffer.from(tx.toCbor(), 'hex');
    await this.#submit.submitTx(
      {
        tx: {
          type: {
            value: cbor,
            case: 'raw',
          },
        },
      },
      { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) },
    );
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
    const stopped = this.abort.signal;
    while (!stopped.aborted) {
      const attempt = new AbortController();
      const stopAttempt = () => attempt.abort();
      stopped.addEventListener('abort', stopAttempt, { once: true });
      let silence: string | null = null;
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      const expectMessageWithin = (ms: number, reason: string) => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          silence = reason;
          attempt.abort();
        }, ms);
      };
      try {
        const intersect = intersectPoints(this.recent).map(toBlockRef);
        if (!intersect.length) {
          if (this.startingPoint) {
            intersect.push({
              slot: BigInt(this.startingPoint.slot),
              hash: Buffer.from(this.startingPoint.hash, 'hex'),
            });
          } else {
            const tip = await this.readTip();
            this.recent.push(tip);
            intersect.push(toBlockRef(tip));
          }
          this.rollbackDepth = 0;
        }
        expectMessageWithin(FIRST_MESSAGE_TIMEOUT_MS, 'FollowTip sent nothing after connecting');
        const stream = this.#sync.followTip({ intersect }, { signal: attempt.signal });
        for await (const response of stream) {
          expectMessageWithin(STREAM_IDLE_TIMEOUT_MS, 'FollowTip stream went silent');
          this.streamError = null;
          await this.onAction(response.action);
          if (this.rollbackDepth > MAX_ROLLBACK_DEPTH) {
            this.streamError = `Cardano rolled back ${this.rollbackDepth} blocks, more than the ${MAX_ROLLBACK_DEPTH} the service can undo`;
            this.logger.error(
              { depth: this.rollbackDepth },
              'CardanoChainStateService stopped following; restart to resume',
            );
            return;
          }
        }
        throw new Error('FollowTip stream ended');
      } catch (err) {
        if (stopped.aborted) {
          return;
        }
        if (errorCode(err) === GRPC_NOT_FOUND) {
          if (this.followersHoldState) {
            this.streamError =
              'None of the recent blocks is on the source chain, so followers cannot roll back to a common block';
            this.logger.error(
              { err },
              'CardanoChainStateService stopped following; restart to resume',
            );
            return;
          }
          // Clearing makes the next attempt start from the source's tip.
          this.recent = [];
        }
        this.streamError = silence ?? String(err);
        this.logger.warn(
          { err, reason: this.streamError },
          'CardanoChainStateService lost the FollowTip stream; reconnecting',
        );
        await pause(RECONNECT_DELAY_MS, stopped);
      } finally {
        clearTimeout(watchdog);
        stopped.removeEventListener('abort', stopAttempt);
      }
    }
  }

  private async onAction(action: TipAction): Promise<void> {
    switch (action.case) {
      case 'apply': {
        this.rollbackDepth = 0;
        this.followersHoldState ||= this.followers.length > 0;
        this.recent.push(blockTip(action.value));
        if (this.recent.length > TRACKED_BLOCKS) {
          this.recent.shift();
        }
        // TODO: some blocks are not parsable with the current cardano-sdk version.
        // Once that's updated, don't swallow errors here
        try {
          const [header, transactions] = parseBlock(action.value.nativeBytes);
          for (const follower of this.followers) {
            await follower.onRollForward(header, transactions);
          }
        } catch (err) {
          this.logger.error({ err }, 'CardanoChainStateService could not parse a block');
        }
        return;
      }
      case 'undo': {
        const undone = blockTip(action.value);
        this.rollbackDepth += 1;
        // Too deep: follow() stops, and the last good tip stays for diagnostics.
        if (this.rollbackDepth > MAX_ROLLBACK_DEPTH) {
          return;
        }
        const at = lastIndexOfHash(this.recent, undone.hash);
        // Within the depth limit, a block older than the window only means the
        // window has not filled yet: there is no tip until the next apply.
        this.recent = at >= 0 ? this.recent.slice(0, at) : [];
        this.logger.info({ slot: undone.slot.toString() }, 'Cardano rollback: block undone');
        // Followers roll back to the block they keep. With none tracked, the
        // undone block is the seed tip or older, which followers never applied.
        const kept = this.recent.at(-1);
        if (kept) {
          const header = tipHeader(kept);
          for (const follower of this.followers) {
            await follower.onRollBackward(header);
          }
        }
        return;
      }
      case 'reset': {
        const header = blockRefHeader(action.value);
        for (const follower of this.followers) {
          await follower.onRollBackward(header);
        }
        // The stream opens with a reset to the intersection it found; a reset to
        // an older tracked block rolls back the blocks after it.
        const at = lastIndexOfHash(this.recent, toHex(action.value.hash));
        if (at < 0) {
          // An untracked intersection, such as the configured starting point, is
          // where followers start: tracking it lets undoing the first applied
          // block roll them back to it.
          this.recent = [refTip(action.value)];
          this.rollbackDepth = 0;
          return;
        }
        this.rollbackDepth += this.recent.length - 1 - at;
        if (this.rollbackDepth > MAX_ROLLBACK_DEPTH) {
          return;
        }
        this.recent = this.recent.slice(0, at + 1);
        return;
      }
    }
  }

  private async readTip(): Promise<CardanoTip> {
    const { tip } = await this.#sync.readTip({}, { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) });
    if (!tip) {
      throw new Error('UTxO RPC ReadTip returned no tip');
    }
    return {
      slot: tip.slot,
      height: tip.height,
      hash: toHex(tip.hash),
      timestamp: new Date(Number(tip.timestamp)),
    };
  }
}

function blockTip(block: sync.AnyChainBlock): CardanoTip {
  const cardano = block.chain.case === 'cardano' ? block.chain.value : undefined;
  if (!cardano?.header) {
    throw new Error('UTxO RPC FollowTip sent a block with no Cardano header');
  }
  return {
    slot: cardano.header.slot,
    height: cardano.header.height,
    hash: toHex(cardano.header.hash),
    timestamp: new Date(Number(cardano.timestamp)),
  };
}

function refTip(blockRef: sync.BlockRef): CardanoTip {
  return {
    slot: blockRef.slot,
    height: blockRef.height,
    hash: toHex(blockRef.hash),
    timestamp: new Date(Number(blockRef.timestamp)),
  };
}

function tipHeader(tip: CardanoTip): PartialBlockHeader {
  return {
    blockNo: BlockNo(Number(tip.height)),
    slot: Slot(Number(tip.slot)),
    hash: BlockId(tip.hash),
  };
}

function blockRefHeader(blockRef: sync.BlockRef): PartialBlockHeader {
  return {
    blockNo: BlockNo(Number(blockRef.height)),
    slot: Slot(Number(blockRef.slot)),
    hash: BlockId(Buffer.from(blockRef.hash).toString('hex')),
  };
}

function errorCode(err: unknown): unknown {
  return typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
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

/** Newest first: the latest blocks one by one, then doubling gaps back to the oldest. */
function intersectPoints(tips: CardanoTip[]): CardanoTip[] {
  const points: CardanoTip[] = [];
  let step = 1;
  for (let i = tips.length - 1; i >= 0; i -= step) {
    points.push(tips[i]);
    if (points.length >= DENSE_INTERSECT_POINTS) {
      step *= 2;
    }
  }
  if (tips.length && points.at(-1) !== tips[0]) {
    points.push(tips[0]);
  }
  return points;
}

function lastIndexOfHash(tips: CardanoTip[], hash: string): number {
  for (let i = tips.length - 1; i >= 0; i--) {
    if (tips[i].hash === hash) {
      return i;
    }
  }
  return -1;
}

function toBlockRef(tip: CardanoTip): Partial<sync.BlockRef> {
  return { slot: tip.slot, hash: Buffer.from(tip.hash, 'hex') };
}

export function toProtocolParams(p: cardano.PParams): CardanoProtocolParams {
  return {
    coinsPerUtxoByte: parseU5CBigInt(p, 'coinsPerUtxoByte'),
    maxTxSize: parseBigInt(p, 'maxTxSize'),
    maxValueSize: parseBigInt(p, 'maxValueSize'),
    minFeeCoefficient: parseU5CBigInt(p, 'minFeeCoefficient'),
    minFeeConstant: parseU5CBigInt(p, 'minFeeConstant'),
    prices: {
      memory: fromRational(p.prices?.memory, 'prices.memory'),
      steps: fromRational(p.prices?.steps, 'prices.steps'),
    },
    minFeeRefScriptCostPerByte: String(
      fromRational(p.minFeeScriptRefCostPerByte, 'minFeeRefScriptCostPerByte'),
    ),
  };
}

export function parseBigInt<K extends keyof cardano.PParams>(
  params: Record<K, bigint>,
  key: K,
): number {
  return fromBigInt(params[key], key);
}

/** Decodes UTxO RPC's BigInt: an int64, or big-endian bytes for larger magnitudes. */
export function parseU5CBigInt<K extends keyof cardano.PParams>(
  params: Partial<Record<K, cardano.BigInt>>,
  key: K,
): number {
  const big = fromU5CBigInt(params[key], key);
  return fromBigInt(big, key);
}

function fromRational(value: cardano.RationalNumber | undefined, field: string): number {
  if (!value || !value.denominator) {
    throw new Error(`Invalid rational value for ${field}`);
  }
  return value.numerator / value.denominator;
}

function fromBigInt(value: bigint, field: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`Invalid value ${value} for protocol parameter ${field}`);
  }
  return Number(value);
}

/** Decodes UTxO RPC's BigInt: an int64, or big-endian bytes for larger magnitudes. */
export function fromU5CBigInt(value: cardano.BigInt | undefined, field: string): bigint {
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

function bytesToBigInt(bytes: Uint8Array): bigint {
  return bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}
