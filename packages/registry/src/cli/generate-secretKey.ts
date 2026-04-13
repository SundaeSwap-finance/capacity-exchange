import * as fs from 'fs';
import { program } from 'commander';
import { runCli } from '@capacity-exchange/midnight-node';
import { generateMnemonic, parseMnemonic } from '@capacity-exchange/midnight-core';

import { generateRandomRegistryKey, type RegistryKey } from '../types.js';

function main(): Promise<void> {
  program
    .name('generate-secret')
    .description('Generates a random secret key for the registry contract')
    .argument('<outputFile>', 'path to write the generated secret key (hex) to')
    .parse();

  const [outputFile] = program.args;

  const secretKey: RegistryKey = generateRandomRegistryKey();
  console.log(`Generated secret key: ${Buffer.from(secretKey).toString('hex').slice(0, 16)}...`);

  fs.writeFileSync(outputFile, Buffer.from(secretKey).toString('hex'));

  return Promise.resolve();
}

runCli(main);