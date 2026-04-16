import * as fs from 'fs';
import { program } from 'commander';
import { runCli } from '@capacity-exchange/midnight-node';

import { generateRandomSecretKey, type RegistrySecretKey } from '../types.js';

async function main(): Promise<void> {
  program
    .name('generate-secret')
    .description('Generates a random secret key for the registry contract')
    .argument('<outputFile>', 'path to write the generated secret key (hex) to')
    .parse();

  const [outputFile] = program.args;

  const secretKey: RegistrySecretKey = generateRandomSecretKey();

  fs.writeFileSync(outputFile, Buffer.from(secretKey).toString('hex'));
}

runCli(main);
