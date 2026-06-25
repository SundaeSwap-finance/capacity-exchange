import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { getContractOutDir } from '@sundaeswap/capacity-exchange-registry/node';

describe('getContractOutDir', () => {
  it('returns a directory containing keys/ and zkir/ subdirectories', () => {
    const noop = () => {};
    const dir = getContractOutDir({ debug: noop, info: noop, warn: noop, error: noop });
    expect(fs.statSync(dir).isDirectory()).toBe(true);
    expect(fs.statSync(path.join(dir, 'keys')).isDirectory()).toBe(true);
    expect(fs.statSync(path.join(dir, 'zkir')).isDirectory()).toBe(true);
  });
});
