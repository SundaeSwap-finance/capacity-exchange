import * as crypto from 'crypto';
import {
  inMemoryPrivateStateProvider,
  runCircuit,
  type CircuitRunner,
  type ForeignOutputBuilder,
  type Leg,
  type LegProviders,
} from '@sundaeswap/capacity-exchange-core';
import { persistentHash, Bytes32Descriptor } from '@midnight-ntwrk/compact-runtime';
import { ZswapOutput, sampleEncryptionPublicKey } from '@midnight-ntwrk/ledger-v8';
import { CouplerRawContract } from './contract.js';
import { createPrivateState, witnesses } from './witnesses.js';

function runCouplerCircuit(
  providers: LegProviders,
  contractAddress: string,
  privateStateId: string,
  circuitName: 'mintReveal' | 'absorb',
  args: Uint8Array[]
): Promise<Leg> {
  const contract = new CouplerRawContract(witnesses) as unknown as CircuitRunner;
  return runCircuit(providers, contract, contractAddress, privateStateId, circuitName, args);
}

/** The shielded burn address as a coin public key: 32 zero bytes. shieldedBurnAddress()
 *  compiles to left({ bytes: 32 zeros }), and a coin sent to the zero key is unspendable. */
const BURN_CPK = '00'.repeat(32);

/** Foreign-output policy for the coupler offer: the only allowed foreign recipient is
 *  the shielded burn address (absorb burns its spent coin). Any other recipient is
 *  rejected, so the sampled encryption key below can never reach a real coin. */
export const burnOutputBuilder: ForeignOutputBuilder = (output, coin) => {
  const { recipient } = output;
  if (!recipient.is_left || !recipient.left.bytes.every((b) => b === 0)) {
    throw new Error('coupler: only the shielded burn address is a supported foreign recipient');
  }
  // The epk must be a valid curve point (zeros throw "invalid group element
  // encoding"), so we sample an ownerless one. Sound ONLY because the zero-cpk coin
  // is unspendable, so its note ciphertext protects nothing anyone can read. Do NOT
  // reuse this builder for real recipients without threading the recipient's real key.
  return ZswapOutput.new(coin, 0, BURN_CPK, sampleEncryptionPublicKey());
};

/** The absorb call, from public data only. Its spend has no source until paired
 *  with a matching mint in the offer. A wrong h' changes the coin so nothing
 *  matches. Either party can build it (LP to dust-fund, user to assemble the offer). */
export async function buildAbsorbLeg(
  walletProvider: LegProviders['walletProvider'],
  publicDataProvider: LegProviders['publicDataProvider'],
  couplerAddress: string,
  h: Uint8Array,
  hPrime: Uint8Array,
  nonce: Uint8Array
): Promise<Leg> {
  const privateStateProvider = inMemoryPrivateStateProvider();
  privateStateProvider.setContractAddress(couplerAddress);
  const privateStateId = crypto.randomBytes(32).toString('hex');
  await privateStateProvider.set(privateStateId, createPrivateState(new Uint8Array(32)));
  const providers: LegProviders = { walletProvider, publicDataProvider, privateStateProvider };
  return runCouplerCircuit(providers, couplerAddress, privateStateId, 'absorb', [h, hPrime, nonce]);
}

/** User side: mintReveal(s, nonce), minting the coin of color
 *  hash(hash(s), hash(s')) to the contract. Returns hs = hash(s). */
export async function buildRevealLeg(
  providers: LegProviders,
  contractAddress: string,
  privateStateId: string,
  s: Uint8Array,
  nonce: Uint8Array
): Promise<{ leg: Leg; hs: Uint8Array }> {
  const leg = await runCouplerCircuit(providers, contractAddress, privateStateId, 'mintReveal', [s, nonce]);
  return { leg, hs: persistentHash(Bytes32Descriptor, s) };
}
