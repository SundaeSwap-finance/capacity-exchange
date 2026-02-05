import { Bip32PrivateKey } from '@blaze-cardano/core';
import { HotWallet, Blockfrost, Blaze } from '@blaze-cardano/sdk';
import * as fs from 'fs';
import { CardanoConfig } from './config';

export function createProvider(config: CardanoConfig): Blockfrost {
  return new Blockfrost({
    network: config.blockfrostNetwork,
    projectId: config.blockfrostProjectId,
  });
}

export async function createBlaze(config: CardanoConfig): Promise<Blaze<Blockfrost, HotWallet>> {
  const provider = createProvider(config);

  const seedHex = fs.readFileSync(config.walletSeedFile, 'utf-8').trim();
  const masterKey = Bip32PrivateKey.fromHex(seedHex);
  const wallet = await HotWallet.fromMasterkey(masterKey.hex(), provider);

  return Blaze.from(provider, wallet);
}
