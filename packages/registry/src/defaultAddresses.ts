const DEFAULT_REGISTRY_ADDRESSES: Record<string, string | undefined> = {
  preview: 'e3de04c29d953a6676fd10b364ed7d7b9d9baabe7b5ee651d5f613f8408702c2',
  preprod: '93c3402590d28979a9278cb25bd1fb413fae9bb921ce8b6642d166b366e30188',
};

export function getDefaultRegistryAddress(networkId: string): string | undefined {
  return DEFAULT_REGISTRY_ADDRESSES[networkId];
}

/**
 * Resolves a registry contract address from an explicit value or the well-known
 * default for the network. Throws if neither is available.
 */
export function resolveRegistryAddress(networkId: string, explicit?: string): string {
  const address = explicit ?? getDefaultRegistryAddress(networkId);
  if (!address) {
    throw new Error(`No registry contract address for network "${networkId}". Pass one explicitly.`);
  }
  return address;
}
