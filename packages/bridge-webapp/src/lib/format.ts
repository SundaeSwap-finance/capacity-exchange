export function truncateAddress(addr: string): string {
  if (addr.length <= 20) {
    return addr;
  }
  return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
}
