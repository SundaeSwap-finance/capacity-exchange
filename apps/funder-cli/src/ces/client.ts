import type { HintsBody } from '@capacity-exchange/cardano-core';
import { decodeHints } from './hints.js';
import { HINTS_PATH, OFFERS_PATH, OfferRejected, type RejectionCode, type SubmitOfferAccepted } from './protocol.js';

/** One instance's published hints, each set decoded and its signature checked. */
export interface InstanceHints {
  url: string;
  sets: Array<{ hex: string; body: HintsBody }>;
}

export interface HintFailure {
  url: string;
  message: string;
}

function base(url: string): string {
  return url.replace(/\/$/, '');
}

/** Reads one exchange's price hints. A set that fails to decode or verify fails the instance. */
export async function fetchHints(url: string): Promise<InstanceHints> {
  const response = await fetch(`${base(url)}${HINTS_PATH}`);
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  const hexes = (await response.json()) as string[];
  return { url, sets: hexes.map((hex) => ({ hex, body: decodeHints(hex).body })) };
}

/** Fans out to every configured instance; a failing instance is reported, not fatal. */
export async function fetchAllHints(urls: string[]): Promise<{ hints: InstanceHints[]; failures: HintFailure[] }> {
  const settled = await Promise.allSettled(urls.map((url) => fetchHints(url)));
  const hints: InstanceHints[] = [];
  const failures: HintFailure[] = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      hints.push(result.value);
    } else {
      failures.push({ url: urls[i], message: String(result.reason?.message ?? result.reason) });
    }
  });
  return { hints, failures };
}

const KNOWN_CODES: RejectionCode[] = [
  'malformed',
  'unsupported-version',
  'not-interested',
  'over-budget',
  'duplicate',
  'settled',
  'expired',
  'invalidated',
  'superseded',
  'busy',
  'not-ready',
];

async function rejectionFrom(response: Response): Promise<OfferRejected> {
  const text = await response.text();
  try {
    // The server answers refusals as `{ error: <code>, message }`.
    const body = JSON.parse(text) as { error?: string; message?: string };
    if (body.error && KNOWN_CODES.includes(body.error as RejectionCode)) {
      return new OfferRejected(body.error as RejectionCode, body.message ?? '');
    }
  } catch {
    // Not JSON; fall through and report it as received.
  }
  // A refusal without a recognised code is treated as `not-interested`, as CIP-0198 directs.
  return new OfferRejected('not-interested', `${response.status} ${text}`);
}

/**
 * Submits an offer: the envelope's raw bytes, as `application/cbor`. The server builds, signs
 * and submits the batch before it answers, so a `202` means the batch is already in its
 * node's mempool. Any refusal comes back instead of it, carrying a CIP-0198 reason.
 */
export async function submitOffer(url: string, envelopeHex: string): Promise<SubmitOfferAccepted> {
  const response = await fetch(`${base(url)}${OFFERS_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/cbor' },
    body: Buffer.from(envelopeHex, 'hex'),
  });
  if (response.status !== 202) {
    throw await rejectionFrom(response);
  }
  return (await response.json()) as SubmitOfferAccepted;
}
