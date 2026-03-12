import { program } from 'commander';
import { generate } from './price-config/generate.ts';
import { validate } from './price-config/validate.ts';

function main() {
  program
    .name('price-config')
    .description('Generate and validate price configs from deployed contracts');

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
