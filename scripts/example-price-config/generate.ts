// Generates a price config for the server from deployed example-webapp contracts.
// This is a dev/demo tool — it wires the example-webapp's token into the server's
// price config so both can be run together locally.
import * as fs from 'fs';
import {
  contractsConfigPath,
  priceConfigPath,
  priceConfigExamplePath,
  readJsonFile,
  requireFile,
} from '../lib/paths.ts';

export function generate(networkId: string): void {
  const contractsPath = contractsConfigPath(networkId);
  requireFile(contractsPath, networkId, 'contracts config');

  const contracts = readJsonFile(contractsPath);
  const example = readJsonFile(priceConfigExamplePath());

  const config = {
    priceFormulas: example.priceFormulas.map((pf: Record<string, string>) => ({
      ...pf,
      currency: contracts.tokenMint.derivedTokenColor,
    })),
    fundedContracts: example.fundedContracts ?? [],
  };

  const outputPath = priceConfigPath(networkId);
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`Generated ${outputPath}`);
}
