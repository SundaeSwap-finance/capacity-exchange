import { SUPPORTED_NETWORK_IDS } from '@sundaeswap/capacity-exchange-core';

/** The runtime config index.html carries. A deploy fills only the network id, via
 * scripts/interpolate-index.ts; the dev server may also fill the overrides. */
export interface AppConfig {
  networkId: string;
  /** Replaces the network's default capacity exchange. */
  capacityExchangeUrl?: string;
  /** Replaces the network's default proof server. */
  proofServerUrl?: string;
  /** Starts the mocked demo flow, as ?mockDemo=1 does. */
  mockDemo?: boolean;
}

declare global {
  interface Window {
    __APP_CONFIG__?: unknown;
  }
}

function optionalUrl(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !URL.canParse(value)) {
    throw new Error(`Invalid ${key} ${JSON.stringify(value)} in app config. Must be a URL.`);
  }
  return value;
}

/** Validates a page's config. An unfilled placeholder is a syntax error in the page script,
 * so it leaves the config unset rather than malformed. */
export function parseAppConfig(raw: unknown): AppConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('index.html carries no app config. Was the bundle interpolated for a network?');
  }
  const fields = raw as Record<string, unknown>;
  const { networkId, mockDemo } = fields;
  if (typeof networkId !== 'string' || !SUPPORTED_NETWORK_IDS.includes(networkId)) {
    throw new Error(
      `Invalid networkId ${JSON.stringify(networkId)} in app config. Must be one of: ${SUPPORTED_NETWORK_IDS.join(', ')}`
    );
  }
  if (mockDemo !== undefined && typeof mockDemo !== 'boolean') {
    throw new Error(`Invalid mockDemo ${JSON.stringify(mockDemo)} in app config. Must be a boolean.`);
  }
  return {
    networkId,
    capacityExchangeUrl: optionalUrl(fields, 'capacityExchangeUrl'),
    proofServerUrl: optionalUrl(fields, 'proofServerUrl'),
    mockDemo,
  };
}

export function readAppConfig(): AppConfig {
  return parseAppConfig(window.__APP_CONFIG__);
}
