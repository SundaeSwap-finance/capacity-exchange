import * as p from '@clack/prompts';
import type {
  ExchangePrice,
  Offer,
  CurrencySelectionResult,
  OfferConfirmationResult,
  PromptForCurrency,
  ConfirmOffer,
} from '@capacity-exchange/components';
import { isJsonMode } from "./output.ts";

function formatSpecks(specks: bigint): string {
  return specks.toLocaleString();
}

function formatTimeUntil(date: Date): string {
  const seconds = Math.max(0, Math.round((date.getTime() - Date.now()) / 1000));
  if (seconds <= 0) return 'expired';
  return `~${seconds}s`;
}

/** Returns the wallet balance for a given token color. */
export type GetTokenBalance = (tokenColor: string) => Promise<bigint>;

export interface CurrencyPromptOptions {
  currencyFlag?: string;
  getTokenBalance?: GetTokenBalance;
}

/**
 * Creates a PromptForCurrency callback that auto-selects if a currency flag is set,
 * otherwise shows an interactive select prompt.
 * If getTokenBalance is provided, verifies the wallet holds enough of the selected token.
 */
export function createCurrencyPrompt(opts: CurrencyPromptOptions = {}): PromptForCurrency {
  const { currencyFlag, getTokenBalance } = opts;

  return async (prices: ExchangePrice[], dustRequired: bigint): Promise<CurrencySelectionResult> => {
    let selected: ExchangePrice;

    if (currencyFlag) {
      const match = prices.find(
        (ep) => ep.price.currency.toLowerCase() === currencyFlag.toLowerCase()
      );
      if (!match) {
        const available = prices.map((ep) => ep.price.currency).join(', ');
        throw new Error(`Currency '${currencyFlag}' not available. Available: ${available}`);
      }
      selected = match;
    } else {
      if (isJsonMode()) {
        throw new Error('Currency selection required in JSON mode. Provide --currency flag.');
      }

      const options = prices.map((ep) => ({
        value: ep,
        label: ep.price.currency,
        hint: `${ep.price.amount} ${ep.price.currency} for ${formatSpecks(dustRequired)} specks`,
      }));

      const result = await p.select({
        message: `Select payment currency (for ${formatSpecks(dustRequired)} specks DUST):`,
        options,
      });

      if (p.isCancel(result)) {
        return { status: 'cancelled' };
      }

      selected = result;
    }

    if (getTokenBalance) {
      const balance = await getTokenBalance(selected.price.currency);
      const required = BigInt(selected.price.amount);
      if (balance < required) {
        throw new Error(
          `Insufficient ${selected.price.currency} balance. ` +
          `Required: ${selected.price.amount}, available: ${balance.toString()}`
        );
      }
    }

    return { status: 'selected', exchangePrice: selected };
  };
}

/**
 * Creates a ConfirmOffer callback that auto-confirms if the flag is set,
 * otherwise shows offer details and prompts for confirmation.
 */
export function createOfferConfirm(autoConfirm?: boolean): ConfirmOffer {
  return async (offer: Offer, dustRequired: bigint): Promise<OfferConfirmationResult> => {
    const offerLines = [
      `Currency:  ${offer.offerCurrency}`,
      `Amount:    ${offer.offerAmount} ${offer.offerCurrency}`,
      `DUST:      ${formatSpecks(dustRequired)} specks`,
      `Expires:   ${offer.expiresAt.toLocaleTimeString()} (${formatTimeUntil(offer.expiresAt)})`,
      `Offer ID:  ${offer.offerId}`,
    ].join('\n');

    if (autoConfirm) {
      if (!isJsonMode()) {
        p.note(offerLines, 'Offer (auto-confirmed)');
      }
      return { status: 'confirmed' };
    }

    if (isJsonMode()) {
      throw new Error('Offer confirmation required in JSON mode. Provide --auto-confirm flag.');
    }

    p.note(offerLines, 'Offer received');

    const confirmed = await p.confirm({
      message: 'Confirm this offer?',
    });

    if (p.isCancel(confirmed)) {
      return { status: 'cancelled' };
    }

    return confirmed ? { status: 'confirmed' } : { status: 'back' };
  };
}
