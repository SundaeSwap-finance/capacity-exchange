import { setTimeout } from 'timers/promises';
import { CapacityExchangeClient } from './client.js';
import { PricesResponse } from './client.js';

export const BASE_URL = process.env.API_URL || 'http://localhost:3000';
export const CLIENT = new CapacityExchangeClient(BASE_URL);

/** Fetch a quoteId for the given specks amount. */
export async function getQuoteId(specks: string): Promise<{ quoteId: string; currency: string }> {
  const res = await CLIENT.getPrices(specks);
  if (res.status !== 200) {
    throw new Error(`Failed to get prices: ${res.status}`);
  }
  const data = res.data as typeof PricesResponse.static;
  return { quoteId: data.quoteId, currency: data.prices[0].currency.id };
}

export async function waitForLocksToRelease() {
  console.log('Waiting for UTxO locks to release');
  await setTimeout(2000);
}
