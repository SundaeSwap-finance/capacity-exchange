/** cardano-cli has no bech32-decode command, so addresses are decoded here. */
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/** Minimal bech32 decode, enough for the address payload cardano-cli hands us. */
export function decodeBech32Address(address: string): Uint8Array {
  const separator = address.lastIndexOf('1');
  if (separator < 0) {
    throw new Error(`Not a bech32 address: ${address}`);
  }
  const dataPart = address.slice(separator + 1).toLowerCase();
  const values: number[] = [];
  for (const char of dataPart) {
    const index = BECH32_CHARSET.indexOf(char);
    if (index < 0) {
      throw new Error(`Invalid bech32 character '${char}' in ${address}`);
    }
    values.push(index);
  }
  // Drop the 6-symbol checksum, then regroup from 5-bit to 8-bit.
  const payload = values.slice(0, -6);
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const value of payload) {
    acc = (acc << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}
