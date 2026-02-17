import { Blaze, Core, makeValue, Provider, Wallet } from "@blaze-cardano/sdk";
import {
  MidnightBech32m,
  ShieldedAddress,
} from "@midnight-ntwrk/wallet-sdk-address-format";
import { buildDepositDatum } from "./datum";

export interface DepositArgs {
  depositAddress: string;
  shieldedMidnightAddress: string;
  lovelace: bigint;
}

export interface DepositResult {
  txHash: string;
  depositAddress: string;
  shieldedMidnightAddress: string;
  coinPublicKey: string;
  lovelace: string;
}

export async function deposit(
  blaze: Blaze<Provider, Wallet>,
  args: DepositArgs,
): Promise<DepositResult> {
  const depositAddress = Core.addressFromBech32(args.depositAddress);

  const parsed = MidnightBech32m.parse(args.shieldedMidnightAddress);
  const shieldedAddress = parsed.decode(ShieldedAddress, parsed.network);
  const coinPublicKey = shieldedAddress.coinPublicKey.toHexString();

  const value = makeValue(args.lovelace);
  const datum = buildDepositDatum(coinPublicKey);

  const tx = await blaze.newTransaction().payAssets(
    depositAddress,
    value,
    datum,
  ).complete();

  const signedTx = await blaze.signTransaction(tx);
  const txHash = await blaze.submitTransaction(signedTx);

  return {
    txHash,
    depositAddress: args.depositAddress,
    shieldedMidnightAddress: args.shieldedMidnightAddress,
    coinPublicKey,
    lovelace: args.lovelace.toString(),
  };
}
