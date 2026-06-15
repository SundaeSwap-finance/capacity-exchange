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
  type UnprovenOffer,
  type UnprovenOutput,
  type ContractOperation,
  type LedgerParameters,
} from '@midnight-ntwrk/ledger-v8';
import { communicationCommitmentRandomness } from '@midnight-ntwrk/compact-runtime';
import { asLedgerProofData, toLedgerContractState, toLedgerCoin, toLedgerTransientCoin } from './toLedger.js';
import { uint8ArrayToHex } from './hex.js';
import type { Leg } from './leg.js';

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
  return legs.reduce(
    (intent, leg, i) => intent.addCall(toCallPrototype(leg, operationOf(leg, ledgerContracts), parts[i])),
    Intent.new(ttl)
  );
}

/** The output's coin, required to be owned by the leg's own contract (the
 *  only recipient the offer assembly supports). */
function ownContractCoin(leg: Leg, output: Leg['zswapOutputs'][number]) {
  const { recipient } = output;
  const ownedByLegContract = !recipient.is_left && uint8ArrayToHex(recipient.right.bytes) === leg.contractAddress;
  if (!ownedByLegContract) {
    throw new Error(
      `buildOffer: output from '${leg.circuitName}' is not owned by its own contract (only contract-owned mints are supported)`
    );
  }
  return output.coinInfo;
}

/** ONE offer over all legs' coins: each spend pairs with its matching mint as
 *  a ZswapTransient (created and consumed in-tx, off the chain tree). Unmatched
 *  mints stay plain outputs. An unmatched spend throws. */
export function buildOffer(legs: Leg[]): UnprovenOffer | undefined {
  const outputs = legs.flatMap((leg) => leg.zswapOutputs.map((o) => ({ leg, coinInfo: ownContractCoin(leg, o) })));
  const spends = legs.flatMap((leg) => leg.zswapInputs);

  const outByKey = new Map<string, { out: UnprovenOutput; coin: ReturnType<typeof toLedgerCoin> }>();
  for (const { leg, coinInfo } of outputs) {
    const key = coinKey(coinInfo);
    if (outByKey.has(key)) {
      throw new Error(`buildOffer: duplicate mint coin ${key.slice(0, 16)} across legs`);
    }
    const coin = toLedgerCoin(coinInfo);
    outByKey.set(key, { out: ZswapOutput.newContractOwned(coin, 0, leg.contractAddress), coin });
  }

  let offer: UnprovenOffer | undefined;
  const add = (next: UnprovenOffer) => (offer = offer ? offer.merge(next) : next);
  for (const spend of spends) {
    const key = coinKey(spend);
    const match = outByKey.get(key);
    if (!match) {
      throw new Error(`buildOffer: unmatched spend input ${key.slice(0, 16)} (no source coin)`);
    }
    const qcoin = toLedgerTransientCoin(spend);
    add(ZswapOffer.fromTransient(ZswapTransient.newFromContractOwnedOutput(qcoin, 0, match.out)));
    outByKey.delete(key);
  }
  // Unmatched mints stay plain outputs. type/value register the offer's deltas,
  // which the effects check requires when the tx is finalized by bind() rather
  // than the wallet's balancing recipe.
  for (const { out, coin } of outByKey.values()) {
    add(ZswapOffer.fromOutput(out, coin.type, coin.value));
  }
  return offer;
}
