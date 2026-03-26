// Validates that the server's price config includes the example-webapp's deployed token.
// This is a dev/demo check — it ensures the server and example-webapp are wired up
// correctly for local development. Production server setup doesn't use this script.
import { contractsConfigPath, priceConfigPath, readJsonFile, requireFile } from '../lib/paths.ts';

function validateSponsoredCircuit(
  priceConfig: Record<string, unknown>,
  contractAddress: string,
  circuitName: string,
  label: string,
  networkId: string,
): void {
  const sponsoredEntry = ((priceConfig.sponsoredContracts ?? []) as { contractAddress: string; circuits?: { type: string; circuitNames?: string[] } }[]).find(
    (sc) => sc.contractAddress === contractAddress,
  );
  if (!sponsoredEntry) {
    console.error(`${label} contract ${contractAddress} not in sponsoredContracts`);
    console.error(`Regenerate: NETWORK_ID=${networkId} task deploy`);
    process.exit(1);
  }
  const circuitNames: string[] =
    sponsoredEntry.circuits?.type === 'subset' ? (sponsoredEntry.circuits.circuitNames ?? []) : [];
  if (!circuitNames.includes(circuitName)) {
    console.error(`Circuit "${circuitName}" not sponsored for ${label} contract ${contractAddress}`);
    console.error(`Regenerate: NETWORK_ID=${networkId} task deploy`);
    process.exit(1);
  }
}

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

  validateSponsoredCircuit(
    priceConfig,
    contracts.counter.contractAddress as string,
    'increment',
    'counter',
    networkId,
  );
  validateSponsoredCircuit(
    priceConfig,
    contracts.tokenMint.contractAddress as string,
    'mint_test_tokens',
    'token mint',
    networkId,
  );

  console.log('Price config validated');
}
