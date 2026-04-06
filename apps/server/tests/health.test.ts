import { describe, it, expect } from 'vitest';
import { CLIENT } from './utils.js';

describe('Health API', () => {
  it('should be live', async () => {
    const res = await CLIENT.getHealth();
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(res.data.uptime).toBeGreaterThan(0);
  });

  it('should be ready', async () => {
    const res = await CLIENT.getReadiness();
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(res.data.wallet.status).toBe('ok');
    expect(res.data.indexer.status).toBe('ok');
  });
});
