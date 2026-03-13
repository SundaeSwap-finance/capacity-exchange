import { deriveTokenColor, hexToBytes } from '@capacity-exchange/midnight-core';

export interface BuildWithdrawalArgsParams {
  contractAddress: string;
  amount: bigint;
  domainSep: string;
  cardanoAddress: string;
  coinNonce: Uint8Array;
  datumHash?: string;
}

export interface WithdrawalArgs {
  coin: { nonce: Uint8Array; color: Uint8Array; value: bigint };
  domainSepBytes: Uint8Array;
  cardanoAddressBytes: Uint8Array;
  maybeDatumHash: { is_some: boolean; value: Uint8Array };
}

/** Build the circuit args for requestWithdrawal — shared between CLI and browser. */
export function buildWithdrawalArgs(params: BuildWithdrawalArgsParams): WithdrawalArgs {
  const { contractAddress, amount, domainSep, cardanoAddress, coinNonce, datumHash } = params;

  const derivedColor = deriveTokenColor(domainSep, contractAddress);

  const coin = {
    nonce: coinNonce,
    color: hexToBytes(derivedColor),
    value: amount,
  };

  return {
    coin,
    domainSepBytes: hexToBytes(domainSep),
    cardanoAddressBytes: hexToBytes(cardanoAddress),
    maybeDatumHash: datumHash
      ? { is_some: true, value: hexToBytes(datumHash) }
      : { is_some: false, value: new Uint8Array(32) },
  };
}
