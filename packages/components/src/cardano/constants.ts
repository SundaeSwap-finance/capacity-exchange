export const LOVELACE_PER_ADA = 1_000_000;
export const ADA_DECIMALS = 6;
export const BIP39_PASSPHRASE = '';

export function lovelaceToAda(lovelace: bigint): string {
  return (Number(lovelace) / LOVELACE_PER_ADA).toFixed(ADA_DECIMALS);
}
