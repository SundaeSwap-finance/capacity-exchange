import { CardanoCli } from '../cardano/cli.js';
import type { Config } from '../config.js';
import { step } from '../log.js';

export interface InitOptions {
  callerWallet: string;
  simulatedCesWallet: string;
  recipientWallet: string;
  faucetUrl: string;
}

/**
 * Creates the three wallets the demo needs. Funding is left to the operator because the faucet
 * is a web form; everything after that is `ces-fund mint`.
 *
 * The recipient gets a full wallet rather than a bare address so its funds can be swept back
 * between runs, which saves re-minting every time the demo is rehearsed.
 */
export function runInit(config: Config, options: InitOptions): void {
  const cli = new CardanoCli(config);

  const note = (created: boolean): string => (created ? '' : '   (existing, left alone)');

  const caller = cli.createWallet(options.callerWallet);
  step('init', `caller          ${caller.address}${note(caller.created)}`);

  const ces = cli.createWallet(options.simulatedCesWallet);
  step('init', `simulated-ces   ${ces.address}   ← stand-in, not a real exchange${note(ces.created)}`);

  const recipient = cli.createWallet(options.recipientWallet);
  step('init', `recipient       ${recipient.address}${note(recipient.created)}`);

  step('init', `faucet: ${options.faucetUrl}`);
  step('init', 'fund the CALLER only; mint sweeps the remainder to the exchange.');
  step('init', `next: ces-fund mint --caller-wallet ${options.callerWallet} --sweep-to ${ces.address}`);
  step(
    'init',
    `then: ces-fund build --caller-wallet ${options.callerWallet} --send <qty>:<unit> --to ${recipient.address}`
  );
}
