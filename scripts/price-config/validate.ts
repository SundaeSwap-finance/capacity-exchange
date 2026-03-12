import {
  contractsConfigPath,
  priceConfigPath,
  readJsonFile,
  requireFile,
} from '../lib/paths.ts';

export function validate(networkId: string): void {
  const pricePath = priceConfigPath(networkId);
  const contractsPath = contractsConfigPath(networkId);
  requireFile(pricePath, networkId, 'price config');
  requireFile(contractsPath, networkId, 'contracts config');

  const contracts = readJsonFile(contractsPath);
  const priceConfig = readJsonFile(pricePath);

  const priceCurrencies = new Set(
    (priceConfig.priceFormulas ?? []).map((pf: { currency: string }) => pf.currency),
  );
  if (!priceCurrencies.has(contracts.tokenMint.derivedTokenColor)) {
    console.error(`Token color ${contracts.tokenMint.derivedTokenColor} not in priceFormulas`);
    console.error(`Regenerate: NETWORK_ID=${networkId} task deploy`);
    process.exit(1);
  }

  console.log('Price config validated');
}
