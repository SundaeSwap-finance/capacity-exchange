import { Address } from '@blaze-cardano/core';
import { makeValue } from '@blaze-cardano/sdk';
import { CardanoConfig } from './config';
import { createBlaze } from './wallet';

export interface SendArgs {
  recipientAddress: string;
  lovelace: bigint;
}

export interface SendResult {
  txHash: string;
  recipientAddress: string;
  lovelace: string;
}

export async function send(config: CardanoConfig, args: SendArgs): Promise<SendResult> {
  const blaze = await createBlaze(config);

  const address = Address.fromBech32(args.recipientAddress);
  const value = makeValue(args.lovelace);

  const tx = await blaze.newTransaction().payAssets(address, value).complete();

  const signedTx = await blaze.signTransaction(tx);
  const txHash = await blaze.submitTransaction(signedTx);

  return {
    txHash,
    recipientAddress: args.recipientAddress,
    lovelace: args.lovelace.toString(),
  };
}
