import { describe, it, expect } from 'vitest';
import { nextDeployPointer } from '../src/deployments.js';

const a = { address: 'aa', sha: 'old' };
const b = { address: 'bb', sha: 'new' };

describe('nextDeployPointer', () => {
  it('starts a pointer with no history', () => {
    expect(nextDeployPointer(null, a)).toEqual({ current: a, history: [] });
  });

  it('is unchanged when pointed at its current deploy', () => {
    const pointer = { current: a, history: [] };
    expect(nextDeployPointer(pointer, a)).toBe(pointer);
  });

  it('keeps the previous deploy in history, so pointing back is a rollback', () => {
    const moved = nextDeployPointer({ current: a, history: [] }, b);
    expect(moved).toEqual({ current: b, history: [a] });
    expect(nextDeployPointer(moved, a)).toEqual({ current: a, history: [a, b] });
  });
});
