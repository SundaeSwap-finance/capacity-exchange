import { program } from 'commander';
import { generate } from './demo-price-config/generate.ts';
import { validate } from './demo-price-config/validate.ts';

function main() {
  program
    .name('demo-price-config')
    .description('Generate and validate server price configs from deployed demo contracts');

  program
    .command('generate')
    .description('Generate a network-specific price config from deployed contracts')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .action(generate);

  program
    .command('validate')
    .description('Validate a price config against deployed contracts')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .action(validate);

  program.parse();
}

main();
