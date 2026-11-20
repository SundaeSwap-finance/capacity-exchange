import { CardanoCli } from '../cardano/cli.js';
import type { Config } from '../config.js';
import { step } from '../log.js';

export interface InitOptions {
  callerWallet: string;
  recipientWallet: string;
  faucetUrl: string;
}

/**
 * Creates the two wallets the demo needs. Funding is left to the operator because the faucet
 * is a web form; everything after that is `ces-fund mint`.
 *
 * The recipient gets a full wallet rather than a bare address so its funds can be swept back
 * between runs, which saves re-minting every time the demo is rehearsed.
 */
export function runInit(config: Config, options: InitOptions): void {
  const cli = new CardanoCli(config);

  const note = (created: boolean): string => (created ? '' : '   (existing, left alone)');

  const caller = cli.createWallet(options.callerWallet);
  step('init', `caller      ${caller.address}${note(caller.created)}`);

  const recipient = cli.createWallet(options.recipientWallet);
  step('init', `recipient   ${recipient.address}${note(recipient.created)}`);

  step('init', `faucet: ${options.faucetUrl}`);
  step('init', "fund the CALLER only; mint sweeps the ADA it doesn't need to the recipient.");
  step('init', `next: ces-fund mint --caller-wallet ${options.callerWallet} --sweep-to ${recipient.address}`);
  step('init', `then: ces-fund balance --caller-wallet ${options.callerWallet}`);
}
