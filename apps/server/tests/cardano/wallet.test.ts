import { describe, it } from 'vitest';
import { fundServerWallet } from './devnet.js';

describe('Cardano wallet', () => {
  it('detects ADA paid to the server wallet', async () => {
    await fundServerWallet(5_000_000n);
  });
});
