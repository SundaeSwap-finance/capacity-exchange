const DEFAULT_REGISTRY_ADDRESSES: Record<string, string | undefined> = {
  preview: '4d0b6d84d14ba0e9eae766a1c6ea95d487a40c67dc9bb9925e56fb0872f67ecb',
  preprod: '892007f66343fe9a9867607d8448fe47ccde964c1dc8021bccaaf97c0bebb0ec',
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
