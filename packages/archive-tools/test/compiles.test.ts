import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';
import { parseContractCompiles, readContractCompiles } from '../src/compiles.js';

const SHA = 'b8606d6cad721eaeae38535ffcc18a61611c4e9f';
const VALID = { counter: SHA, 'token-mint': SHA, registry: SHA };

describe('parseContractCompiles', () => {
  it('accepts a full pin', () => {
    expect(parseContractCompiles(VALID, 'pins')).toEqual(VALID);
  });

  it.each([null, [], 'pins'])('rejects %j, which is not an object', (raw) => {
    expect(() => parseContractCompiles(raw, 'pins')).toThrow(/must be a JSON object/);
  });

  it('rejects a missing contract', () => {
    const { registry: _, ...missing } = VALID;
    expect(() => parseContractCompiles(missing, 'pins')).toThrow(/'registry' must be a full 40-character git sha/);
  });

  it.each(['b8606d6', SHA.toUpperCase(), `${SHA}0`])('rejects sha %s', (sha) => {
    expect(() => parseContractCompiles({ ...VALID, counter: sha }, 'pins')).toThrow(/'counter'/);
  });

  it('rejects a contract it does not know, so a typo cannot hide a missing pin', () => {
    expect(() => parseContractCompiles({ ...VALID, countr: SHA }, 'pins')).toThrow(/unknown contracts countr/);
  });
});

// The monorepo's own pin file is what every build and deploy reads.
it('the monorepo pin file is valid', () => {
  const path = fileURLToPath(new URL('../../../contract-compiles.json', import.meta.url));
  expect(() => readContractCompiles(path)).not.toThrow();
});
