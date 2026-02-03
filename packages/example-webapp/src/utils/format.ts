const DUST_DECIMALS = 1_000_000_000_000_000n;
const NIGHT_DECIMALS = 1_000_000n;

export function formatDust(value: bigint): string {
  return (value / DUST_DECIMALS).toLocaleString();
}

export function formatNight(value: bigint): string {
  return (value / NIGHT_DECIMALS).toLocaleString();
}
