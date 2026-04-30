const DEFAULT_REGISTRY_ADDRESSES: Record<string, string | undefined> = {
  preview: '031f39efac81c9b656f4d91ef291a4d1c981f460a100601ae1f6a1e7b20f1b1b',
  preprod: '926e111d46992869775101830e4e75129606baee3b58056465f788922c48f42f',
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
