import { describe, it, expect } from 'vitest';
import { Contract, ledger } from '../out/contract/index.js';
import { createConstructorContext, createCircuitContext } from '@midnight-ntwrk/compact-runtime';
import { cellWritesInProgram } from '@sundaeswap/capacity-exchange-core';
import { S_SLOT, HSP_SLOT } from '../src/lib/disclosure.js';

const S = new Uint8Array(32).fill(0xaa);
const S_PRIME = new Uint8Array(32).fill(0xbb);
const NONCE = new Uint8Array(32).fill(0xcc);

/** Run mintReveal in-process, with no chain and no proof server. */
function runMintReveal() {
  const contract = new Contract({ sPrime: (ctx: never) => [ctx, S_PRIME] } as never);
  const init = contract.initialState(createConstructorContext(null, '0'.repeat(64)) as never);
  const context = createCircuitContext('02'.repeat(32), '0'.repeat(64), init.currentContractState, null);
  return contract.impureCircuits.mintReveal(context as never, S, NONCE) as never as {
    context: { currentQueryContext: { state: unknown } };
    proofData: { publicTranscript: never[] };
  };
}

// The reader finds s and hsp by slot number. Nothing in the type system ties those numbers to the
// contract, so a compiler that renumbered the ledger fields would silently transpose the two
// secrets. The generated `ledger` accessor is the compiler's own mapping, so comparing against it
// fails on that renumbering instead of returning the wrong values.
describe('slot numbers still match the contract', () => {
  it('reads the same values the generated accessor reads', () => {
    const out = runMintReveal();
    const named = ledger(out.context.currentQueryContext.state as never);
    const bySlot = cellWritesInProgram(out.proofData.publicTranscript);

    expect(bySlot.get(S_SLOT)).toEqual(named.lastS);
    expect(bySlot.get(HSP_SLOT)).toEqual(named.lastHsp);
  });

  it('the two fields hold different values, so a transposition would be caught', () => {
    const out = runMintReveal();
    const named = ledger(out.context.currentQueryContext.state as never);

    expect(named.lastS).toEqual(S);
    expect(named.lastHsp).not.toEqual(named.lastS);
  });
});
