const DEFAULT_REGISTRY_ADDRESSES: Record<string, string | undefined> = {
  preview: 'e5e6b7df948c16d7bcd7d5c982e1be3636b08d0d3aa9bd9c710a204714d59aae',
  preprod: '4dd6a6b6b859606f72607de4d1aaeac6196f3b1eb778d0fd5e252c0a68d712bc',
  mainnet: 'e1c688c297ef5787b08d8f0078932bba8c091bd5873b155d9793e10bd9a22fd7',
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
