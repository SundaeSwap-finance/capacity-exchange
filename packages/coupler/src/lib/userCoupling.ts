import { buildOffer, buildFragmentTx } from '@sundaeswap/capacity-exchange-core';
import { persistentHash, Bytes32Descriptor } from '@midnight-ntwrk/compact-runtime';
import type { LedgerParameters } from '@midnight-ntwrk/ledger-v8';
import type { UnboundTransaction, PrivateStateProvider } from '@midnight-ntwrk/midnight-js/types';
import { buildRevealLeg, buildAbsorbLeg, burnOutputBuilder } from './couplerLegs.js';
import { type CouplingRequest } from './couplingParams.js';
import { type CouplerContext } from './context.js';

export interface PrepareUserFragmentParams {
  couplerAddress: string;
  swapId: string;
  /** The user's secret. h = hash(s) goes in the request to the LP. */
  s: Uint8Array;
  /** h' = hash(s'), the user's second commitment. */
  hPrime: Uint8Array;
  /** The coin-pairing tag, caller-owned so the fragment proves without a round-trip. */
  nonce: Uint8Array;
  /** Dust the user asks the LP to fund, in specks. */
  vFeeSpecks: bigint;
  /** The fee basis for this coupling, resolved once by the caller so every fragment and the
   *  final bound tx are priced against the same parameters. */
  ledgerParameters: LedgerParameters;
  /** ttl for the user's own intent. Long enough to outlive proving and the final
   *  submit, else the merge cannot bind. */
  ttl: Date;
  /** The store holding this swap's s' under swapId. */
  privateStateProvider: PrivateStateProvider;
}

export interface PreparedUserFragment {
  /** Ready to merge with the LP's capacity fragment. */
  proven: UnboundTransaction;
  /** The terms to send to the LP, who funds the dust against them. */
  request: CouplingRequest;
  /** hs = hash(s), the disclosed reveal commitment. */
  hs: Uint8Array;
}

/**
 * User side, before the LP. Prove the reveal fragment (mintReveal and the offer
 * pairing its mint with the absorb spend). The absorb call is the LP's, rejoining
 * at the final merge. Uses the user's own params/ttl, so nothing waits on the LP.
 */
export async function prepareUserFragment(
  context: CouplerContext,
  params: PrepareUserFragmentParams
): Promise<PreparedUserFragment> {
  const { couplerAddress, swapId, s, hPrime, nonce, vFeeSpecks, ttl, privateStateProvider, ledgerParameters } = params;
  const h = persistentHash(Bytes32Descriptor, s);

  // Reveal fragment: mintReveal and the offer pairing its mint with the absorb
  // spend (the absorb call is the LP's). Coupler keys only.
  context.logger.info('Proving reveal fragment...');
  const walletProvider = { getCoinPublicKey: () => context.coinPublicKey };
  const absorbLeg = await buildAbsorbLeg(walletProvider, context.publicDataProvider, couplerAddress, h, hPrime, nonce);
  privateStateProvider.setContractAddress(couplerAddress);
  const revealProviders = {
    walletProvider,
    publicDataProvider: context.publicDataProvider,
    privateStateProvider,
  };
  const { leg: revealLeg, hs } = await buildRevealLeg(revealProviders, couplerAddress, swapId, s, nonce);
  const revealFragment = buildFragmentTx([revealLeg], ttl, ledgerParameters, {
    offer: buildOffer([revealLeg, absorbLeg], burnOutputBuilder),
  });
  const proven = await context.proofProvider.proveTx(revealFragment);

  return { proven, request: { h, hPrime, nonce, vFeeSpecks }, hs };
}
