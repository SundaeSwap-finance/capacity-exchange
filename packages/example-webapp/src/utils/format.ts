const DUST_DECIMALS = 1_000_000_000_000_000n;
const NIGHT_DECIMALS = 1_000_000n;

export function formatDust(value: bigint): string {
  return (value / DUST_DECIMALS).toLocaleString();
}

export function formatNight(value: bigint): string {
  return (value / NIGHT_DECIMALS).toLocaleString();
}

export function truncateMiddle(str: string, startChars = 8, endChars = 8): string {
  if (str.length <= startChars + endChars + 3) {
    return str;
  }
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
}
