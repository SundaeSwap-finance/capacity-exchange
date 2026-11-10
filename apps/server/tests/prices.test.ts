import { describe, it, expect } from 'vitest';
import { CLIENT } from './utils.js';
import { PricesResponse } from './client.js';
import { getLedgerParameters } from '@sundaeswap/capacity-exchange-core';
import { feeUnitSpecks } from '../src/services/midnight/fee-unit.js';

// The server's indexer: the env override, else the default for MIDNIGHT_NETWORK=undeployed.
const INDEXER_URL = process.env.MIDNIGHT_INDEXER_URL ?? 'http://localhost:8088/api/v3/graphql';
// The server's default OFFER_FEE_OVERHEAD_UNITS.
const OFFER_FEE_OVERHEAD_UNITS = 6n;

describe('Prices API', () => {
  it('should return a list of prices with a quoteId', async () => {
    // The offer fee overhead follows the chain's current fee prices, so derive it the same way
    // the server does rather than hard-coding it.
    const unit = feeUnitSpecks(await getLedgerParameters(INDEXER_URL));
    const specks = 1000n + OFFER_FEE_OVERHEAD_UNITS * unit;
    // price-config.test.json: 101 + specks * 11 / 1000
    const expectedAmount = (101n + (specks * 11n) / 1000n).toString();

    const res = await CLIENT.getPrices('1000');
    expect(res.status).toBe(200);

    const data = res.data as typeof PricesResponse.static;
    expect(data.quoteId).toBeDefined();
    expect(data.prices).toEqual([
      {
        currency: {
          id: 'midnight:shielded:1337133713371337133713371337133713371337133713371337133713371337',
          type: 'midnight:shielded',
          rawId: '1337133713371337133713371337133713371337133713371337133713371337',
        },
        amount: expectedAmount,
      },
      {
        currency: {
          id: 'midnight:unshielded:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
          type: 'midnight:unshielded',
          rawId: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        },
        amount: expectedAmount,
      },
    ]);
  });
});
