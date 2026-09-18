import { CardanoCli } from '../cardano/cli.js';
import { checkInclusion } from '../cardano/inclusion.js';
import { assetLabel } from '../cardano/value.js';
import type { Config } from '../config.js';
import { formatAsset, plain, step } from '../log.js';
import { reportWait } from './submit.js';

export interface StatusOptions {
  address?: string[];
  txid?: string;
  wait?: boolean;
  timeout: string;
  pollInterval: string;
}

/** Reports what each named address holds, and/or whether a transaction has been included. */
export async function runStatus(config: Config, options: StatusOptions): Promise<void> {
  const cli = new CardanoCli(config);

  if (options.txid) {
    if (options.wait) {
      await reportWait(cli, options.txid, options);
    } else {
      const { state } = checkInclusion(cli, options.txid);
      step('status', `${options.txid} — ${state}`);
      if (state === 'pending') {
        step('status', 'add --wait to poll until it lands');
      }
    }
  }

  for (const address of options.address ?? []) {
    const utxos = cli.queryUtxo(address);
    const totals = new Map<string, bigint>();
    let lovelace = 0n;
    for (const utxo of utxos) {
      lovelace += utxo.value.lovelace;
      for (const [unit, quantity] of utxo.value.assets) {
        totals.set(unit, (totals.get(unit) ?? 0n) + quantity);
      }
    }
    const assets = [...totals].map(([unit, q]) => `${formatAsset(q)} ${assetLabel(unit)}`).join(', ');
    plain(`  ${address.slice(0, 20)}…   ${formatAsset(lovelace)} ADA${assets ? `   ${assets}` : ''}`);
  }
}
