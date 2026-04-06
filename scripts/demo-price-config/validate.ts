// Validates that the server's price config includes the demo's deployed token.
// This is a dev/demo check — it ensures the server and demo are wired up
// correctly for local development. Production server setup doesn't use this script.
import { contractsConfigPath, priceConfigPath, readJsonFile, requireFile } from '../lib/paths.ts';

export function validate(networkId: string): void {
  const pricePath = priceConfigPath(networkId);
  const contractsPath = contractsConfigPath(networkId);
  requireFile(pricePath, networkId, 'price config');
  requireFile(contractsPath, networkId, 'contracts config');

  const contracts = readJsonFile(contractsPath);
  const priceConfig = readJsonFile(pricePath);

  const priceCurrencies = new Set((priceConfig.priceFormulas ?? []).map((pf: { currency: string }) => pf.currency));
  if (!priceCurrencies.has(contracts.tokenMint.derivedTokenColor)) {
    console.error(`Token color ${contracts.tokenMint.derivedTokenColor} not in priceFormulas`);
    console.error(`Regenerate: NETWORK_ID=${networkId} task deploy`);
    process.exit(1);
  }

  const sponsoredEntry = (priceConfig.sponsoredContracts ?? []).find(
    (sc: { contractAddress: string }) => sc.contractAddress === contracts.counter.contractAddress
  );
  if (!sponsoredEntry) {
    console.error(`Counter contract ${contracts.counter.contractAddress} not in sponsoredContracts`);
    console.error(`Regenerate: NETWORK_ID=${networkId} task deploy`);
    process.exit(1);
  }
  const circuitNames: string[] =
    sponsoredEntry.circuits?.type === 'subset' ? (sponsoredEntry.circuits.circuitNames ?? []) : [];
  if (!circuitNames.includes('increment')) {
    console.error(`Circuit "increment" not sponsored for counter contract ${contracts.counter.contractAddress}`);
    console.error(`Regenerate: NETWORK_ID=${networkId} task deploy`);
    process.exit(1);
  }

  console.log('Price config validated');
}
