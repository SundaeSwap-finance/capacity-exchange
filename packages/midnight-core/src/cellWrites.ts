import { type Op, type AlignedValue } from '@midnight-ntwrk/ledger-v8';
import { Bytes32Descriptor } from '@midnight-ntwrk/compact-runtime';

/** A cell's value, as the ledger represents it. */
export type CellValue = AlignedValue['value'];

/** Reads the value out of an operation that pushes one onto the stack, or nothing if the
 *  operation does something else. */
function pushedCell(op: Op<AlignedValue>): CellValue | undefined {
  return pushedAligned(op)?.value;
}

/** The pushed cell with its alignment, which declares the field's real width. */
function pushedAligned(op: Op<AlignedValue>): AlignedValue | undefined {
  return typeof op === 'object' && 'push' in op && op.push.value.tag === 'cell' ? op.push.value.content : undefined;
}

/** Whether this operation writes a whole field. A deeper insert writes inside a map or an
 *  array, which is not what we are looking for. */
function writesWholeField(op: Op<AlignedValue>): boolean {
  return typeof op === 'object' && 'ins' in op && op.ins.n === 1;
}

/** Which contract field a write is aimed at. Fields are numbered, and the number arrives as a
 *  short key. A long key is an entry inside a map, so it has no field number. */
function slotIndex(key: CellValue): number | undefined {
  if (key.length !== 1 || key[0].length > 1) {
    return undefined;
  }
  return key[0][0] ?? 0;
}

/** The written value, as the 32 bytes the circuit used. A field-aligned value is trimmed of
 *  trailing zeros, so only the alignment says how wide the field really is. */
function decodeBytes32(aligned: AlignedValue): Uint8Array | undefined {
  const { alignment } = aligned;
  const atom = alignment.length === 1 ? alignment[0] : undefined;
  if (atom?.tag !== 'atom' || atom.value.tag !== 'bytes' || atom.value.length !== 32) {
    return undefined;
  }
  return Bytes32Descriptor.fromValue([...aligned.value]);
}

/** Every 32-byte field a program wrote, by slot number. */
export function cellWritesInProgram(program: Op<AlignedValue>[]): Map<number, Uint8Array> {
  const bySlot = new Map<number, Uint8Array>();
  for (let i = 2; i < program.length; i++) {
    if (!writesWholeField(program[i])) {
      continue;
    }
    const key = pushedCell(program[i - 2]);
    const written = pushedAligned(program[i - 1]);
    if (key == null || written == null) {
      continue;
    }
    const value = decodeBytes32(written);
    if (value == null) {
      continue;
    }
    const slot = slotIndex(key);
    if (slot != null) {
      bySlot.set(slot, value);
    }
  }
  return bySlot;
}

/** Two programs, scanned apart so no write spans the join, and a slot written in both resolves
 *  to the one that always applies. */
export function mergeCellWrites(
  guaranteed: Op<AlignedValue>[] | undefined,
  fallible: Op<AlignedValue>[] | undefined
): Map<number, Uint8Array> {
  const writes = cellWritesInProgram(fallible ?? []);
  for (const [slot, value] of cellWritesInProgram(guaranteed ?? [])) {
    writes.set(slot, value);
  }
  return writes;
}
