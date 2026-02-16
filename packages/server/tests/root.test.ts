import { describe, it, expect } from 'vitest';
import { CLIENT } from './utils.js';

describe('Root API', () => {
  it('should return service info', async () => {
    const res = await CLIENT.getRoot();
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('capacity-exchange-server');
  });
});
