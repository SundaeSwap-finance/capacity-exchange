import { program } from 'commander';
import { generate } from './example-price-config/generate.ts';
import { validate } from './example-price-config/validate.ts';

function main() {
  program
    .name('example-price-config')
    .description('Generate and validate server price configs from deployed example-webapp contracts');

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
