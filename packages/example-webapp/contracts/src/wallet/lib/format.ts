export function bigintBalances(record: Record<string, bigint>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [type, amount] of Object.entries(record)) {
    out[type] = amount.toString();
  }
  return out;
}
