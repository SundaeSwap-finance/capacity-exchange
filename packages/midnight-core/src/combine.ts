/**
 * Assembles legs into a Midnight transaction's two halves: buildIntent the
 * program (one call per leg), buildOffer the money (each spend paired with its
 * matching mint as an in-tx transient, which binds independent calls together).
 * fragment.ts wraps these into per-party fragments. All wasm-boundary
 * translation into ledger-v8 types lives in toLedger.ts.
 */
import {
  PreTranscript,
  partitionTranscripts,
  ContractCallPrototype,
  Intent,
  ZswapOffer,
  ZswapOutput,
  ZswapTransient,
  QueryContext,
  type ContractState,
  type ShieldedCoinInfo,
  type UnprovenOffer,
  type UnprovenOutput,
  type ContractOperation,
  type LedgerParameters,
} from '@midnight-ntwrk/ledger-v8';
import { communicationCommitmentRandomness } from '@midnight-ntwrk/compact-runtime';
import { asLedgerProofData, toLedgerContractState, toLedgerCoin, toLedgerTransientCoin } from './toLedger.js';
import { uint8ArrayToHex } from './hex.js';
import type { Leg, EncodedInput } from './leg.js';

/** Coin key for pairing a mint output with the matching spend input. */
const coinKey = (c: { nonce: Uint8Array; color: Uint8Array; value: bigint }) =>
  `${uint8ArrayToHex(c.nonce)}|${uint8ArrayToHex(c.color)}|${c.value}`;

/** A leg's contract state and query context in ledger form. */
interface LedgerContract {
  cs: ContractState;
  qc: QueryContext;
}

/** Byte-equality for two Uint8Arrays. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/** One ledger state and QueryContext per contract. Same-contract legs may
 *  share these only if built against the same pre-state. Mismatches throw. */
function toLedgerContracts(legs: Leg[]): Map<string, LedgerContract> {
  const ledgerContracts = new Map<string, LedgerContract>();
  const preStates = new Map<string, Uint8Array>();
  for (const leg of legs) {
    const serialized = leg.contractState.serialize();
    const seen = preStates.get(leg.contractAddress);
    if (seen && !bytesEqual(seen, serialized)) {
      throw new Error(
        `buildIntent: legs for contract ${leg.contractAddress.slice(0, 16)} were built against different pre-states`
      );
    }
    if (seen) {
      continue;
    }
    preStates.set(leg.contractAddress, serialized);
    const cs = toLedgerContractState(serialized);
    ledgerContracts.set(leg.contractAddress, { cs, qc: new QueryContext(cs.data, leg.contractAddress) });
  }
  return ledgerContracts;
}

/** The contract's operation for a leg's circuit. */
function operationOf(leg: Leg, ledgerContracts: Map<string, LedgerContract>): ContractOperation {
  const op = ledgerContracts.get(leg.contractAddress)!.cs.operation(leg.circuitName);
  if (!op) {
    throw new Error(`buildIntent: contract ${leg.contractAddress.slice(0, 16)} has no operation '${leg.circuitName}'`);
  }
  return op;
}

/** One leg's call prototype, from its proof data and partitioned transcript. */
function toCallPrototype(
  leg: Leg,
  op: ContractOperation,
  [guaranteed, fallible]: ReturnType<typeof partitionTranscripts>[number]
): ContractCallPrototype {
  const proofData = asLedgerProofData(leg.proofData);
  return new ContractCallPrototype(
    leg.contractAddress,
    leg.circuitName,
    op,
    guaranteed,
    fallible,
    proofData.privateTranscriptOutputs,
    proofData.input,
    proofData.output,
    communicationCommitmentRandomness(),
    leg.circuitName
  );
}

/** Build the Intent: partition every leg's transcript together, then add one
 *  ContractCallPrototype per leg. ledgerParameters is chain context for the
 *  whole transaction, supplied once by the assembler. */
export function buildIntent(legs: Leg[], ttl: Date, ledgerParameters: LedgerParameters): ReturnType<typeof Intent.new> {
  if (legs.length === 0) {
    throw new Error('buildIntent requires at least one leg');
  }
  const ledgerContracts = toLedgerContracts(legs);
  const pres = legs.map(
    (leg) =>
      new PreTranscript(ledgerContracts.get(leg.contractAddress)!.qc, asLedgerProofData(leg.proofData).publicTranscript)
  );
  const parts = partitionTranscripts(pres, ledgerParameters);
  if (parts.length !== legs.length) {
    throw new Error(`buildIntent: partitioned ${parts.length} transcripts for ${legs.length} legs`);
  }
  return legs.reduce(
    (intent, leg, i) => intent.addCall(toCallPrototype(leg, operationOf(leg, ledgerContracts), parts[i])),
    Intent.new(ttl)
  );
}

/** Builds an output for a non-contract recipient. Injected, since the assembler
 *  has no recipient encryption key (the coupler's burn policy supplies one). */
export type ForeignOutputBuilder = (output: Leg['zswapOutputs'][number], coin: ShieldedCoinInfo) => UnprovenOutput;

/** Outputs split by transient-eligibility: contract-owned mints (keyed, pairable)
 *  and foreign outputs (always plain). */
interface CollectedOutputs {
  mints: Map<string, UnprovenOutput>;
  foreign: UnprovenOutput[];
}

/** Build each leg output: contract-owned mints into the keyed pool, others via
 *  buildForeign. Duplicate mint coins throw; a foreign recipient with no builder throws. */
function collectOutputs(legs: Leg[], buildForeign?: ForeignOutputBuilder): CollectedOutputs {
  const mints = new Map<string, UnprovenOutput>();
  const foreign: UnprovenOutput[] = [];
  const outputs = legs.flatMap((leg) => leg.zswapOutputs.map((output) => ({ leg, output })));
  for (const { leg, output } of outputs) {
    const { recipient } = output;
    const coin = toLedgerCoin(output.coinInfo);
    const contractOwned = !recipient.is_left && uint8ArrayToHex(recipient.right.bytes) === leg.contractAddress;
    if (!contractOwned) {
      if (!buildForeign) {
        throw new Error(
          `buildOffer: output from '${leg.circuitName}' is not contract-owned and no foreign-output builder was supplied`
        );
      }
      foreign.push(buildForeign(output, coin));
      continue;
    }
    const key = coinKey(output.coinInfo);
    if (mints.has(key)) {
      throw new Error(`buildOffer: duplicate mint coin ${key.slice(0, 16)} across legs`);
    }
    mints.set(key, ZswapOutput.newContractOwned(coin, 0, leg.contractAddress));
  }
  return { mints, foreign };
}

/** Pair each spend with its matching mint as a transient, removing the paired
 *  mint. Only contract-owned mints are passed in, so a transient is never built
 *  from a foreign output. Duplicate or unmatched spend throws. */
function takeTransients(spends: EncodedInput[], mints: Map<string, UnprovenOutput>): UnprovenOffer[] {
  const transients: UnprovenOffer[] = [];
  const consumed = new Set<string>();
  for (const spend of spends) {
    const key = coinKey(spend);
    if (consumed.has(key)) {
      throw new Error(`buildOffer: duplicate spend input ${key.slice(0, 16)} across legs`);
    }
    const out = mints.get(key);
    if (!out) {
      throw new Error(`buildOffer: unmatched spend input ${key.slice(0, 16)} (no source coin)`);
    }
    consumed.add(key);
    mints.delete(key);
    const qcoin = toLedgerTransientCoin(spend);
    transients.push(ZswapOffer.fromTransient(ZswapTransient.newFromContractOwnedOutput(qcoin, 0, out)));
  }
  return transients;
}

/** One offer over all legs' coins: spends paired with their mints as transients,
 *  leftover mints and foreign outputs emitted plain. */
export function buildOffer(legs: Leg[], buildForeign?: ForeignOutputBuilder): UnprovenOffer | undefined {
  const { mints, foreign } = collectOutputs(legs, buildForeign);
  const transients = takeTransients(
    legs.flatMap((leg) => leg.zswapInputs),
    mints
  );
  const plain = [...mints.values(), ...foreign].map((out) => ZswapOffer.fromOutput(out));
  return [...transients, ...plain].reduce<UnprovenOffer | undefined>(
    (offer, next) => (offer ? offer.merge(next) : next),
    undefined
  );
}
