import { describe, it, expect } from 'vitest';
import { selectDeployKey } from '../src/archive-reads.js';

const SHA = 'b8606d6cad721eaeae38535ffcc18a61611c4e9f';
const prefix = `archive/${SHA}/counter/deploys/`;
const twoDeploys = [`${prefix}abc.json`, `${prefix}def.json`];
const pointerTo = (address: string, sha = SHA) => ({ current: { address, sha }, history: [] });

describe('selectDeployKey', () => {
  it('returns the one record, whatever the pointer says', () => {
    expect(selectDeployKey([`${prefix}abc.json`], pointerTo('zzz', 'other'), 'counter', SHA, 'bucket')).toBe(
      `${prefix}abc.json`
    );
  });

  it('ignores keys that are not records', () => {
    expect(selectDeployKey([prefix, `${prefix}abc.json`], null, 'counter', SHA, 'bucket')).toBe(`${prefix}abc.json`);
  });

  it('points at the contract runbook when the env has no deploy of the compile', () => {
    expect(() => selectDeployKey([], null, 'counter', SHA, 'bucket')).toThrow(/no deploy of counter.*runbook/);
  });

  it('uses the pointer to choose among redeploys of the same compile', () => {
    expect(selectDeployKey(twoDeploys, pointerTo('def'), 'counter', SHA, 'bucket')).toBe(`${prefix}def.json`);
  });

  it.each([
    ['no pointer', null],
    ['a pointer at another compile', pointerTo('def', 'other')],
    ['a pointer at an unrecorded deploy', pointerTo('zzz')],
  ])('refuses to guess among several deploys with %s', (_label, pointer) => {
    expect(() => selectDeployKey(twoDeploys, pointer, 'counter', SHA, 'bucket')).toThrow(
      /2 deploys of counter.*point-deployment/
    );
  });
});
