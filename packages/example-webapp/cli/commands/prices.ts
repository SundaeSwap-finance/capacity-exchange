import * as p from '@clack/prompts';
import { Configuration, DefaultApi } from '@capacity-exchange/client';
import { checkCesHealth } from '../lib/ces-health';
import { createSpinner, printHeader, printNote, printJson, isJsonMode } from '../lib/output';

export interface PriceEntry {
  currency: string;
  amount: string;
  specks: string;
}

export interface PricesResult {
  exchangeUrl: string;
  specks: string;
  prices: PriceEntry[];
}

export interface PricesConfig {
  capacityExchangeUrl: string;
}

export async function runPrices(config: PricesConfig, opts: { specks?: string }): Promise<void> {
  printHeader('CES Exchange Prices');

  let specks = opts.specks;
  if (!specks) {
    if (isJsonMode()) {
      throw new Error('--specks is required in JSON mode.');
    }
    const result = await p.text({
      message: 'Enter DUST amount in specks:',
      placeholder: '1000000',
      validate: (val = '') => {
        if (!val.trim()) return 'Required';
        try {
          const n = BigInt(val.trim());
          if (n <= 0n) return 'Must be positive';
        } catch {
          return 'Must be a valid number';
        }
        return undefined;
      },
    });
    if (p.isCancel(result)) {
      process.exit(130);
    }
    specks = result;
  }

  const spin = createSpinner();
  spin.start('Checking CES exchange...');
  const health = await checkCesHealth(config.capacityExchangeUrl);
  if (health.status === 'syncing') {
    spin.stop('CES exchange is syncing');
    throw new Error('CES exchange is syncing, try again later.');
  }
  if (health.status === 'offline') {
    spin.stop('CES exchange is offline');
    throw new Error(`CES exchange at ${config.capacityExchangeUrl} is offline: ${health.error}`);
  }
  spin.stop('CES exchange is healthy');

  spin.start('Fetching prices...');
  const api = new DefaultApi(new Configuration({ basePath: config.capacityExchangeUrl }));
  const pricesResponse = await api.apiPricesGet({ specks });
  spin.stop('Prices fetched');

  const prices: PriceEntry[] = pricesResponse.prices.map((price) => ({
    currency: price.currency,
    amount: price.amount,
    specks,
  }));

  const pricesResult: PricesResult = {
    exchangeUrl: config.capacityExchangeUrl,
    specks,
    prices,
  };

  if (isJsonMode()) {
    printJson(pricesResult);
  } else {
    if (prices.length === 0) {
      printNote('No prices available for the given amount.', 'Exchange Prices');
    } else {
      const lines = prices.map(
        (entry) =>
          `${entry.currency.padEnd(12)} ${entry.amount} ${entry.currency} for ${BigInt(entry.specks).toLocaleString()} specks`
      );
      printNote(lines.join('\n'), `Exchange Prices (for ${BigInt(specks).toLocaleString()} specks)`);
    }
  }
}
