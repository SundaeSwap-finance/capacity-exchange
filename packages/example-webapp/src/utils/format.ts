const NIGHT_DECIMALS = 1_000_000n;

// TODO: verify correct decimal count for DUST token
const DUST_DECIMALS = 9;

export function formatDust(amount: bigint): string {
  const str = amount.toString().padStart(DUST_DECIMALS + 1, '0');
  const intPart = str.slice(0, -DUST_DECIMALS) || '0';
  const decPart = str.slice(-DUST_DECIMALS).replace(/0+$/, '');
  return decPart ? `${intPart}.${decPart}` : intPart;
}

export function formatNight(value: bigint): string {
  return (value / NIGHT_DECIMALS).toLocaleString();
}

export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function formatTimeRemaining(expiresAt: Date): string {
  const remaining = expiresAt.getTime() - Date.now();
  if (remaining <= 0) {
    return 'Expired';
  }
  return formatElapsed(remaining);
}

export function truncateMiddle(str: string, startChars = 8, endChars = 8): string {
  if (str.length <= startChars + endChars + 3) {
    return str;
  }
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
}
