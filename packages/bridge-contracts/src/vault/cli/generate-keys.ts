import * as fs from 'fs';
import { program } from 'commander';
import { runCli } from '@capacity-exchange/midnight-node';
import { generateKeyPair } from '../lib/schnorr.js';

interface GenerateKeysOutput {
  file: string;
  count: number;
}

function main(): Promise<GenerateKeysOutput> {
  program
    .name('vault:generate-keys')
    .description('[Internal] Generates Schnorr key pairs and saves them to a JSON file')
    .argument('<outputFile>', 'Path to write the key pairs JSON file')
    .argument('[count]', 'Number of key pairs to generate', '3')
    .parse();

  const [outputFile] = program.args;
  const count = parseInt(program.processedArgs[1] ?? '3', 10);
  if (isNaN(count) || count <= 0) {
    throw new Error(`Invalid count: ${program.processedArgs[1]}`);
  }

  const keyPairs = Array.from({ length: count }, () => {
    const kp = generateKeyPair();
    return {
      secretKey: kp.secretKey.toString(),
      publicKey: {
        x: kp.publicKey.x.toString(),
        y: kp.publicKey.y.toString(),
      },
    };
  });

  fs.writeFileSync(outputFile, JSON.stringify(keyPairs, null, 2) + '\n');

  return Promise.resolve({ file: outputFile, count });
}

runCli(main);
