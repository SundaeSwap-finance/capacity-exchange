// Generates a price config for the server from deployed demo contracts.
// This is a dev/demo tool — it wires the demo's token into the server's
// price config so both can be run together locally.
import * as fs from 'fs';
import {
  contractsConfigPath,
  priceConfigExamplePath,
  priceConfigPath,
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
    sponsorAll: example.sponsorAll ?? false,
    sponsoredContracts: [
      {
        contractAddress: contracts.counter.contractAddress,
        circuits: { type: 'subset', circuitNames: ['increment'] },
      },
      {
        contractAddress: contracts.tokenMint.contractAddress,
        circuits: {
          type: 'subset',
          circuitNames: [
            'mint_test_tokens',
            'first_deposit',
            'deposit',
            'withdraw',
            'own_balance',
            'total_held',
            'get_token_color',
          ],
        },
      },
    ],
  };

  const outputPath = priceConfigPath(networkId);
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`Generated ${outputPath}`);
}
