import { describe, it, expect } from 'vitest';
import { cellWritesInProgram, mergeCellWrites, S_SLOT, HSP_SLOT } from '../src/lib/disclosure.js';

const bytes32 = [{ tag: 'atom', value: { tag: 'bytes', length: 32 } }];
const bytesN = (n: number) => [{ tag: 'atom', value: { tag: 'bytes', length: n } }];

const push = (value: unknown[], alignment: unknown) => ({
  push: { storage: false, value: { tag: 'cell', content: { value, alignment } } },
});
const ins = (n = 1) => ({ ins: { cached: false, n } });

/** A write of `value` to slot 0, declared with `alignment`. */
const program = (value: Uint8Array, alignment: unknown) =>
  [push([new Uint8Array([])], bytes32), push([value], alignment), ins()] as never;

const slots = (p: never) => [...cellWritesInProgram(p).keys()].sort();

describe('a disclosure cell is read by what its alignment declares', () => {
  // Field-aligned values are trimmed, so a 32-byte field arrives short whenever its trailing
  // byte is zero. Reading the raw length drops the write and loses the secret it carried.
  it('restores a value trimmed of its trailing zero', () => {
    const trimmed = new Uint8Array(31).fill(7);
    const written = cellWritesInProgram(program(trimmed, bytes32)).get(S_SLOT);
    expect(written).toHaveLength(32);
    expect(written?.[31]).toBe(0);
    expect(written?.slice(0, 31)).toEqual(trimmed);
  });

  // The encoding trims EVERY trailing zero, not one. A decoder that restored a single byte
  // would pass the case above and still lose a secret ending in two zeros.
  it.each([1, 2, 8, 31])('restores a value trimmed of %i trailing zeros', (zeros) => {
    const original = Uint8Array.from([...new Uint8Array(32 - zeros).fill(7), ...new Uint8Array(zeros)]);
    const trimmed = original.slice(0, 32 - zeros);
    expect(cellWritesInProgram(program(trimmed, bytes32)).get(S_SLOT)).toEqual(original);
  });

  // A secret of all zeros encodes to nothing at all, the furthest the trimming goes.
  it('restores a value trimmed away entirely', () => {
    const written = cellWritesInProgram(program(new Uint8Array(0), bytes32)).get(S_SLOT);
    expect(written).toEqual(new Uint8Array(32));
  });

  // Leading zeros are never trimmed, so a secret starting 0x0000 arrives at full width.
  it('leaves a value with leading zeros alone', () => {
    const original = Uint8Array.from([0, 0, ...new Uint8Array(30).fill(7)]);
    expect(cellWritesInProgram(program(original, bytes32)).get(S_SLOT)).toEqual(original);
  });

  it('reads a value that needed no trimming', () => {
    const full = new Uint8Array(32).fill(3);
    expect(cellWritesInProgram(program(full, bytes32)).get(S_SLOT)).toEqual(full);
  });

  it('ignores a field of some other declared width', () => {
    expect(slots(program(new Uint8Array(16).fill(9), bytesN(16)))).toEqual([]);
    expect(slots(program(new Uint8Array(64).fill(9), bytesN(64)))).toEqual([]);
  });

  it('ignores a value wider than the field it claims to be', () => {
    expect(slots(program(new Uint8Array(32).fill(9), bytesN(16)))).toEqual([]);
  });

  it('ignores an alignment that is not a single atom', () => {
    expect(slots(program(new Uint8Array(32).fill(9), [...bytes32, ...bytes32]))).toEqual([]);
  });

  // Past the alignment gate the field IS 32 bytes, so a value that cannot decode is a real
  // failure, not a cell to skip. Swallowing it resurfaces later as a missing slot with no reason.
  it('does not hide a value that declares 32 bytes but cannot decode', () => {
    expect(() => cellWritesInProgram(program(new Uint8Array(33).fill(9), bytes32))).toThrow(/Bytes\[32\]/);
  });
});

// A call carries two programs, one that always applies and one the ledger can roll back. They
// are separate instruction streams, so scanning their concatenation invents a boundary that
// does not exist.
describe('the two programs of a call are scanned apart', () => {
  const key0 = push([new Uint8Array([])], bytesN(1));
  const val = (fill: number) => push([new Uint8Array(32).fill(fill)], bytes32);

  // Neither program contains a complete write. Glued, the pushes at the end of the first sit in
  // front of the store at the start of the second, and a write appears that nothing performed.
  it('does not invent a write across the join', () => {
    const guaranteed = [key0, val(7)] as never;
    const fallible = [ins()] as never;

    expect(slots([...(guaranteed as never[]), ...(fallible as never[])] as never)).toEqual([S_SLOT]);
    expect([...mergeCellWrites(guaranteed, fallible).keys()]).toEqual([]);
  });

  it('reads a write from each program', () => {
    const guaranteed = [key0, val(1), ins()] as never;
    const fallible = [push([new Uint8Array([1])], bytesN(1)), val(2), ins()] as never;
    expect([...mergeCellWrites(guaranteed, fallible).keys()].sort()).toEqual([S_SLOT, HSP_SLOT]);
  });

  // The rollback-able program must not win a slot the always-applies one also wrote.
  it('prefers the program that always applies when both write a slot', () => {
    const guaranteed = [key0, val(1), ins()] as never;
    const fallible = [key0, val(2), ins()] as never;
    expect(mergeCellWrites(guaranteed, fallible).get(S_SLOT)).toEqual(new Uint8Array(32).fill(1));
  });

  it('handles a call with only one program', () => {
    const guaranteed = [key0, val(1), ins()] as never;
    expect([...mergeCellWrites(guaranteed, undefined).keys()]).toEqual([S_SLOT]);
    expect([...mergeCellWrites(undefined, guaranteed).keys()]).toEqual([S_SLOT]);
  });
});
