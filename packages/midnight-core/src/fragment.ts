import {
  Transaction,
  DustActions,
  Intent,
  type UnprovenTransaction,
  type UnprovenOffer,
  type LedgerParameters,
} from '@midnight-ntwrk/ledger-v8';
import type { UnprovenDustSpend } from '@midnight-ntwrk/wallet-sdk/dust/v1';
import { getNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { buildIntent } from './combine.js';
import type { Leg } from './leg.js';

/** A dust payment attached to the fragment's intent. Because it shares the intent
 *  with the calls, proving binds it to their effects, so the proven spend cannot
 *  be lifted onto an unrelated transaction. */
export interface DustAttachment {
  spend: UnprovenDustSpend;
  /** Latest block timestamp (not wall clock). */
  ctime: Date;
}

export interface FragmentOptions {
  /** Offer carried by this fragment (built from any party's legs via buildOffer). */
  offer?: UnprovenOffer;
  dust?: DustAttachment;
}

function attachDust(intent: ReturnType<typeof Intent.new>, dust: DustAttachment): void {
  intent.dustActions = new DustActions('signature', 'pre-proof', dust.ctime, [dust.spend]);
}

/**
 * One party's independently-buildable piece of a multi-party transaction: an
 * intent over its legs, optionally carrying the offer and a dust payment.
 * Fragments are proven separately, then merged and bound by the submitting
 * party. Keep the ttl short (minutes): nodes reject long-ttl intents on
 * bind-finalized transactions.
 */
export function buildFragmentTx(
  legs: Leg[],
  ttl: Date,
  ledgerParameters: LedgerParameters,
  options: FragmentOptions = {}
): UnprovenTransaction {
  const intent = buildIntent(legs, ttl, ledgerParameters);
  if (options.dust) {
    attachDust(intent, options.dust);
  }
  return Transaction.fromPartsRandomized(getNetworkId(), options.offer, undefined, intent);
}

/** A calls-free intent carrying only a dust payment. */
export function buildDustIntent(dust: DustAttachment, ttl: Date): ReturnType<typeof Intent.new> {
  const intent = Intent.new(ttl);
  attachDust(intent, dust);
  return intent;
}

/** A dust-only fragment (no calls), the CES sponsorship shape. */
export function buildDustFragmentTx(dust: DustAttachment, ttl: Date): UnprovenTransaction {
  return Transaction.fromPartsRandomized(getNetworkId(), undefined, undefined, buildDustIntent(dust, ttl));
}
