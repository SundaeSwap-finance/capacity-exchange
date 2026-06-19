import { uint8ArrayToHex, getLedgerParameters, buildOffer, buildFragmentTx } from '@sundaeswap/capacity-exchange-core';
import { persistentHash, Bytes32Descriptor } from '@midnight-ntwrk/compact-runtime';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { buildRevealLeg, buildAbsorbLeg, burnOutputBuilder } from './couplerLegs.js';
import { type CapacityFragment } from './capacity.js';
import { type CouplingRequest } from './couplingParams.js';
import { type CouplingEnv } from './env.js';

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
  /** ttl for the user's own intent. Long enough to outlive proving and the final
   *  submit, else the merge cannot bind. */
  ttl: Date;
}

export interface PreparedUserFragment {
  /** Ready to merge with the LP's capacity fragment. */
  proven: UnboundTransaction;
  /** The terms to send to the LP, who funds the dust against them. */
  request: CouplingRequest;
  /** hs = hash(s), the disclosed reveal commitment. */
  hs: Uint8Array;
}

export interface FinalizeCouplingParams {
  couplerAddress: string;
  prepared: PreparedUserFragment;
  /** The LP's proven capacity fragment, merged with the user's. A mismatch is caught at bind. */
  capacity: CapacityFragment;
}

export interface CoupleOutput {
  contractAddress: string;
  txHash: string;
  status: string;
  hs: string;
  hPrime: string;
  nonce: string;
}

/**
 * User side, before the LP. Prove the reveal fragment (mintReveal and the offer
 * pairing its mint with the absorb spend). The absorb call is the LP's, rejoining
 * at the final merge. Uses the user's own params/ttl, so nothing waits on the LP.
 */
export async function prepareUserFragment(
  env: CouplingEnv,
  params: PrepareUserFragmentParams
): Promise<PreparedUserFragment> {
  const { couplerAddress, swapId, s, hPrime, nonce, vFeeSpecks, ttl } = params;
  const h = persistentHash(Bytes32Descriptor, s);
  const ledgerParameters = await getLedgerParameters(env.indexerHttpUrl);

  // Reveal fragment: mintReveal and the offer pairing its mint with the absorb
  // spend (the absorb call is the LP's). Coupler keys only.
  env.logger.info('Proving reveal fragment...');
  const walletProvider = { getCoinPublicKey: () => env.coinPublicKey };
  const absorbLeg = await buildAbsorbLeg(walletProvider, env.publicDataProvider, couplerAddress, h, hPrime, nonce);
  env.privateStateProvider.setContractAddress(couplerAddress);
  const revealProviders = {
    walletProvider,
    publicDataProvider: env.publicDataProvider,
    privateStateProvider: env.privateStateProvider,
  };
  const { leg: revealLeg, hs } = await buildRevealLeg(revealProviders, couplerAddress, swapId, s, nonce);
  const revealFragment = buildFragmentTx([revealLeg], ttl, ledgerParameters, {
    offer: buildOffer([revealLeg, absorbLeg], burnOutputBuilder),
  });
  const proven = await httpClientProofProvider(env.proofServerUrl, env.zkConfigProvider).proveTx(revealFragment);

  return { proven, request: { h, hPrime, nonce, vFeeSpecks }, hs };
}

/**
 * User side, after the LP. Merge the user's fragment with the LP's capacity, bind,
 * and submit, no wallet balancing. A wrong-commitment capacity carries an absorb
 * coin that matches no mint, so bind rejects it.
 */
export async function finalizeCoupling(env: CouplingEnv, params: FinalizeCouplingParams): Promise<CoupleOutput> {
  const { couplerAddress, prepared, capacity } = params;
  const { priced } = capacity;

  env.logger.info('Merging fragments, binding, submitting...');
  const bound = capacity.proven.merge(prepared.proven).bind();
  const txId = await env.midnightProvider.submitTx(bound);
  // A watch failure (e.g. timeout) means we could not confirm, not that the tx failed.
  const fin = await env.publicDataProvider.watchForTxData(txId).catch((e) => {
    env.logger.warn(`watch failed: ${(e as Error).message}`);
    return undefined;
  });
  if (fin && fin.status !== 'SucceedEntirely') {
    throw new Error(`finalizeCoupling: coupling failed on chain: ${fin.status} (tx ${txId})`);
  }
  const status = fin?.status ?? `submitted:${txId}`;
  env.logger.info(`Coupling with capacity ${status}`);
  return {
    contractAddress: couplerAddress,
    txHash: txId,
    status,
    hs: uint8ArrayToHex(prepared.hs),
    hPrime: uint8ArrayToHex(priced.hPrime),
    nonce: uint8ArrayToHex(priced.nonce),
  };
}
