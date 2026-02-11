import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

export type ExtensionAvailabilityResult = { status: 'available'; connector: InitialAPI } | { status: 'unavailable' };

/**
 * Checks for the Lace wallet extension availability.
 */
export function useExtensionAvailability(): ExtensionAvailabilityResult {
  if (typeof window === 'undefined') {
    return { status: 'unavailable' };
  }

  const connector = (window as Window & { midnight?: { mnLace?: InitialAPI } }).midnight?.mnLace;

  if (!connector) {
    return { status: 'unavailable' };
  }

  return { status: 'available', connector };
}
