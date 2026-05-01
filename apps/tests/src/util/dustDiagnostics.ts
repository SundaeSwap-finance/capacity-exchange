import type { MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8';
import { LedgerParameters } from '@midnight-ntwrk/ledger-v8';
import { createLogger } from '@sundaeswap/capacity-exchange-nodejs';
import { uint8ArrayToHex, type Logger } from '@sundaeswap/capacity-exchange-core';

const defaultLogger = createLogger(import.meta);

interface ChainSnapshot {
  blockHeight: number;
  blockTimestampMs: number;
  dustGracePeriodSec: number;
}

async function fetchChainSnapshot(indexerHttpUrl: string): Promise<ChainSnapshot> {
  const r = await fetch(indexerHttpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ block { height timestamp ledgerParameters } }' }),
  });
  const j = (await r.json()) as { data: { block: { height: number; timestamp: number; ledgerParameters: string } } };
  const blk = j.data.block;
  const params = LedgerParameters.deserialize(Buffer.from(blk.ledgerParameters, 'hex'));
  return {
    blockHeight: blk.height,
    blockTimestampMs: blk.timestamp,
    dustGracePeriodSec: Number(params.dust.dustGracePeriodSeconds),
  };
}

function extractDustCtimes(tx: FinalizedTransaction): { ctimeIso: string; ctimeMs: number; ttlIso: string }[] {
  const out: { ctimeIso: string; ctimeMs: number; ttlIso: string }[] = [];
  if (!tx.intents) {
    return out;
  }
  for (const intent of tx.intents.values()) {
    if (intent.dustActions) {
      const ctime = intent.dustActions.ctime;
      out.push({
        ctimeIso: ctime.toISOString(),
        ctimeMs: ctime.valueOf(),
        ttlIso: intent.ttl.toISOString(),
      });
    }
  }
  return out;
}

export function wrapMidnightProviderForDustDiagnostics(
  inner: MidnightProvider,
  indexerHttpUrl: string,
  logger: Logger = defaultLogger
): MidnightProvider {
  return {
    async submitTx(tx) {
      let snapshot: ChainSnapshot | null = null;
      try {
        snapshot = await fetchChainSnapshot(indexerHttpUrl);
      } catch (err) {
        logger.warn({ err: String(err) }, '[dust-diag] failed to fetch chain snapshot');
      }

      const dustActions = extractDustCtimes(tx);
      const nowMs = Date.now();
      const txHex = uint8ArrayToHex(tx.serialize());

      for (const da of dustActions) {
        const tblockMs = snapshot?.blockTimestampMs ?? nowMs;
        const lagSec = (tblockMs - da.ctimeMs) / 1000;
        const graceSec = snapshot?.dustGracePeriodSec ?? null;
        const withinWindow =
          graceSec !== null ? da.ctimeMs <= tblockMs && da.ctimeMs + graceSec * 1000 >= tblockMs : null;
        logger.info(
          {
            ctimeIso: da.ctimeIso,
            ttlIso: da.ttlIso,
            tblockIso: new Date(tblockMs).toISOString(),
            blockHeight: snapshot?.blockHeight ?? null,
            nowIso: new Date(nowMs).toISOString(),
            lagSec,
            graceSec,
            withinWindow,
          },
          '[dust-diag] pre-submit dust window check'
        );
      }

      if (dustActions.length === 0) {
        logger.info({ blockHeight: snapshot?.blockHeight ?? null }, '[dust-diag] tx has no dust actions');
      }

      try {
        return await inner.submitTx(tx);
      } catch (err) {
        logger.error(
          {
            err: err instanceof Error ? err.message : String(err),
            txHexHead: txHex.slice(0, 64),
            txHexLen: txHex.length,
            dustActions,
            chainSnapshot: snapshot,
          },
          '[dust-diag] submitTx FAILED'
        );
        throw err;
      }
    },
  };
}
