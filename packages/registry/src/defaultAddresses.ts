const DEFAULT_REGISTRY_ADDRESSES: Record<string, string | undefined> = {
  preview: '4d0b6d84d14ba0e9eae766a1c6ea95d487a40c67dc9bb9925e56fb0872f67ecb',
  preprod: '892007f66343fe9a9867607d8448fe47ccde964c1dc8021bccaaf97c0bebb0ec',
  mainnet: '5454ecdb483b8f5d3bab1149a296bf04aea00f1ee3395d4d2dbc66702f05aabe',
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
