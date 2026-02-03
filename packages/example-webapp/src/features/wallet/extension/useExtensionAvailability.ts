import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

export type ExtensionAvailabilityResult = { status: 'available'; connector: InitialAPI } | { status: 'unavailable' };

/**
 * Checks for the Lace wallet extension availability.
 */
export function useExtensionAvailability(): ExtensionAvailabilityResult {
  if (typeof window === 'undefined') {
    return { status: 'unavailable' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const connector = w.midnight?.mnLace;

  if (!connector) {
    return { status: 'unavailable' };
  }

  return { status: 'available', connector };
}
