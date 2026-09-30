/** Console output helpers. Every line is tagged with the step that produced it. */

const ADA_DECIMALS = 6n;
const LOVELACE_PER_ADA = 10n ** ADA_DECIMALS;

export function step(tag: string, message: string): void {
  console.log(`[${tag}] ${message}`);
}

export function plain(message = ''): void {
  console.log(message);
}

export function check(tag: string, message: string): void {
  console.log(`[${tag}]   ✓ ${message}`);
}

export function warn(message: string): void {
  console.log(`  ⚠ ${message}`);
}

/** Reports an artifact this command produced, so the next command's input is obvious. */
export function wrote(tag: string, path: string): void {
  console.log(`[${tag}] wrote ${path}`);
}

/** A boxed notice, used to make the simulated CES step impossible to miss. */
export function banner(title: string, lines: string[]): void {
  const width = Math.max(title.length + 4, ...lines.map((l) => l.length + 2));
  console.log(`╭─ ${title} ${'─'.repeat(Math.max(0, width - title.length - 3))}╮`);
  for (const line of lines) {
    console.log(`│ ${line.padEnd(width - 1)}│`);
  }
  console.log(`╰${'─'.repeat(width + 1)}╯`);
}

/** 1180000 -> "1.180000". Always six decimal places so columns line up. */
export function formatAda(value: bigint | number): string {
  const lovelace = BigInt(value);
  const negative = lovelace < 0n;
  const abs = negative ? -lovelace : lovelace;
  const whole = abs / LOVELACE_PER_ADA;
  const frac = (abs % LOVELACE_PER_ADA).toString().padStart(Number(ADA_DECIMALS), '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/** Native assets have no on-chain decimals; the demo treats tokenA as 6dp for readability. */
export function formatAsset(value: bigint | number, decimals = 6): string {
  const quantity = BigInt(value);
  if (decimals === 0) {
    return quantity.toString();
  }
  const scale = 10n ** BigInt(decimals);
  const negative = quantity < 0n;
  const abs = negative ? -quantity : quantity;
  const frac = (abs % scale).toString().padStart(decimals, '0');
  return `${negative ? '-' : ''}${abs / scale}.${frac}`;
}

/** Shortens a long hex identifier for display: 3f2a1b...9c0d -> "3f2a1b…". */
export function short(hex: string, keep = 6): string {
  return hex.length <= keep ? hex : `${hex.slice(0, keep)}…`;
}

/** Addresses are shortened in the middle so both the prefix and checksum stay recognisable. */
export function shortAddress(address: string, head = 14, tail = 6): string {
  return address.length <= head + tail ? address : `${address.slice(0, head)}…${address.slice(-tail)}`;
}
