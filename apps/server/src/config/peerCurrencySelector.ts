import type { FastifyBaseLogger } from 'fastify';
import type { ExchangePrice, PromptForCurrency } from '@sundaeswap/capacity-exchange-providers';
import type { WalletService } from '../services/wallet.js';
import type { PeerPriceService } from '../services/peerPrice.js';

interface Candidate {
  price: ExchangePrice;
  offered: bigint;
  max: bigint;
}

/**
 * {@link PromptForCurrency} picking smallest `offered / max` ratio after
 * filtering (allowlist / max / balance). Ties break on `rawId` lex. Returns
 * `{status:'no-eligible'}` if none survive. Cross-currency ratios assume
 * operator sets each max in a common unit (e.g., USD-equivalent).
 */
export function createAutoSelectCurrency(
  log: FastifyBaseLogger,
  walletService: WalletService,
  peerPriceService: PeerPriceService,
): PromptForCurrency {
  return async (prices: ExchangePrice[], dustRequired: bigint, requestId: string) => {
    if (prices.length === 0) {
      log.info({ requestId }, 'No peer prices offered');
      return { status: 'no-eligible' };
    }

    log.debug(
      {
        requestId,
        dustRequired: dustRequired.toString(),
        prices: prices.map((p) => ({ currency: p.price.currency, amount: p.price.amount })),
      },
      'Available exchange prices',
    );

    return selectFromCandidates(
      prices,
      dustRequired,
      requestId,
      log,
      walletService,
      peerPriceService,
    );
  };
}

/** Filter, pick best candidate, and return a `CurrencySelectionResult`. */
async function selectFromCandidates(
  prices: ExchangePrice[],
  dustRequired: bigint,
  requestId: string,
  log: FastifyBaseLogger,
  walletService: WalletService,
  peerPriceService: PeerPriceService,
): ReturnType<PromptForCurrency> {
  const balances = await walletService.getShieldedTokenBalances();
  const candidates = filterCandidates(prices, balances, peerPriceService, dustRequired, log);

  if (candidates.length === 0) {
    log.info({ requestId }, 'No peer prices met sponsor fallback criteria');
    return { status: 'no-eligible' };
  }

  const selected = pickLowestRatio(candidates);

  log.info(
    {
      currency: selected.price.price.currency,
      amount: selected.price.price.amount,
      max: selected.max.toString(),
    },
    'Auto-selected exchange currency',
  );
  return { status: 'selected', exchangePrice: selected.price };
}

/** Keep only offers that are allowlisted, within max, and affordable. */
function filterCandidates(
  prices: ExchangePrice[],
  balances: Record<string, bigint>,
  peerPriceService: PeerPriceService,
  dustRequired: bigint,
  log: FastifyBaseLogger,
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const price of prices) {
    const offered = BigInt(price.price.amount);
    const max = peerPriceService.getMaxPrice(price.price.currency, dustRequired);
    if (max === undefined) {
      log.debug(
        { currency: price.price.currency },
        'Skipping price: currency not allowlisted for sponsor fallback',
      );
      continue;
    }
    if (max === 0n) {
      log.debug({ currency: price.price.currency }, 'Skipping price: configured max is zero');
      continue;
    }
    if (offered > max) {
      log.debug(
        { currency: price.price.currency, offered: offered.toString(), max: max.toString() },
        'Skipping price: offered amount exceeds configured max',
      );
      continue;
    }
    const balance = balances[price.price.currency.rawId] ?? 0n;
    if (balance < offered) {
      log.debug(
        {
          currency: price.price.currency,
          offered: offered.toString(),
          balance: balance.toString(),
        },
        'Skipping price: insufficient balance',
      );
      continue;
    }
    candidates.push({ price, offered, max });
  }
  return candidates;
}

/** Smallest `offered/max` ratio wins. Cross-mult to stay in bigint. Ties: `rawId` lex. */
function pickLowestRatio(candidates: Candidate[]): Candidate {
  return candidates.reduce((best, curr) => {
    const lhs = curr.offered * best.max;
    const rhs = best.offered * curr.max;
    if (lhs < rhs) {
      return curr;
    }
    if (lhs > rhs) {
      return best;
    }
    return curr.price.price.currency.rawId < best.price.price.currency.rawId ? curr : best;
  });
}
