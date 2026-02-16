import { setTimeout } from 'timers/promises';
import { CapacityExchangeClient } from './client.js';

export const BASE_URL = process.env.API_URL || 'http://localhost:3000';
export const CLIENT = new CapacityExchangeClient(BASE_URL);

export const DEFAULT_REQUEST = {
  specks: '1000',
  offerCurrency: 'lovelace',
};

export async function waitForLocksToRelease() {
  console.log('Waiting for UTxO locks to release');
  await setTimeout(2000);
}
