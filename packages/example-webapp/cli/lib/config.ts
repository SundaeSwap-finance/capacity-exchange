import { resolveEndpoints, toNetworkIdEnum, type NetworkEndpoints } from '@capacity-exchange/midnight-core';

export interface CliConfig {
  json: boolean;
  networkId: string;
  endpoints: NetworkEndpoints;
  capacityExchangeUrl: string;
}

/**
 * Read an env var, checking both with and without VITE_ prefix.
 * This lets the CLI share the same .env file as the webapp.
 */
function env(name: string): string | undefined {
  return process.env[name] ?? process.env[`VITE_${name}`];
}

/**
 * Resolve CLI config for commands that need full endpoint resolution (increment, balances).
 * Throws if proof server is not configured.
 */
export function resolveCliConfig(opts: {
  json?: boolean;
  network?: string;
  exchangeUrl?: string;
}): CliConfig {
  const networkId = opts.network ?? env('NETWORK_ID') ?? 'preprod';
  const endpoints = resolveEndpoints(
    toNetworkIdEnum(networkId),
    env('PROOF_SERVER_URL')
  );
  const capacityExchangeUrl =
    opts.exchangeUrl ?? env('CAPACITY_EXCHANGE_URL') ?? '';
  return { json: opts.json ?? false, networkId, endpoints, capacityExchangeUrl };
}

/**
 * Resolve CLI config for CES-only commands (prices) that just need the exchange URL.
 * Does not require proof server to be configured.
 */
export function resolveCesOnlyConfig(opts: {
  json?: boolean;
  network?: string;
  exchangeUrl?: string;
}): { json: boolean; networkId: string; capacityExchangeUrl: string } {
  const networkId = opts.network ?? env('NETWORK_ID') ?? 'preprod';
  const capacityExchangeUrl =
    opts.exchangeUrl ?? env('CAPACITY_EXCHANGE_URL');
  if (!capacityExchangeUrl) {
    throw new Error('CES exchange URL required. Set --exchange-url or CAPACITY_EXCHANGE_URL env var.');
  }
  return { json: opts.json ?? false, networkId, capacityExchangeUrl };
}
