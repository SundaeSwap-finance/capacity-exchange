import * as p from "@clack/prompts";
import type {
  ConfirmOffer,
  CurrencySelectionResult,
  ExchangePrice,
  Offer,
  OfferConfirmationResult,
  PromptForCurrency,
} from "@capacity-exchange/components";
import { formatDust, formatTimeRemaining } from "@capacity-exchange/midnight-core";

/** Returns the wallet balance for a given token color. */
export type GetTokenBalance = (tokenColor: string) => Promise<bigint>;

export interface CurrencyPromptOptions {
  json?: boolean;
  currencyFlag?: string;
  getTokenBalance?: GetTokenBalance;
}

function findByFlag(prices: ExchangePrice[], flag: string): ExchangePrice {
  const match = prices.find(
    (ep) => ep.price.currency.toLowerCase() === flag.toLowerCase(),
  );
  if (!match) {
    const available = prices.map((ep) => ep.price.currency).join(", ");
    throw new Error(
      `Currency '${flag}' not available. Available: ${available}`,
    );
  }
  return match;
}

async function assertSufficientBalance(
  selected: ExchangePrice,
  getTokenBalance: GetTokenBalance,
): Promise<void> {
  const balance = await getTokenBalance(selected.price.currency);
  const required = BigInt(selected.price.amount);
  if (balance < required) {
    throw new Error(
      `Insufficient ${selected.price.currency} balance. ` +
        `Required: ${selected.price.amount}, available: ${balance.toString()}`,
    );
  }
}

export function createCurrencyPrompt(
  opts: CurrencyPromptOptions = {},
): PromptForCurrency {
  const { json, currencyFlag, getTokenBalance } = opts;

  return async (
    prices: ExchangePrice[],
    dustRequired: bigint,
  ): Promise<CurrencySelectionResult> => {
    let selected: ExchangePrice;

    if (currencyFlag) {
      selected = findByFlag(prices, currencyFlag);
    } else {
      if (json) {
        throw new Error(
          "Currency selection required in JSON mode. Provide --currency flag.",
        );
      }

      const options = prices.map((ep) => ({
        value: ep,
        label: ep.price.currency,
        hint: `${ep.price.amount} ${ep.price.currency} for ${
          formatDust(dustRequired)
        } specks`,
      }));

      const result = await p.select({
        message: `Select payment currency (for ${
          formatDust(dustRequired)
        } specks DUST):`,
        options,
      });

      if (p.isCancel(result)) {
        return { status: "cancelled" };
      }

      selected = result;
    }

    if (getTokenBalance) {
      await assertSufficientBalance(selected, getTokenBalance);
    }

    return { status: "selected", exchangePrice: selected };
  };
}

/**
 * Creates a ConfirmOffer callback that auto-confirms if the flag is set,
 * otherwise shows offer details and prompts for confirmation.
 */
export function createOfferConfirm(opts: { json?: boolean; autoConfirm?: boolean } = {}): ConfirmOffer {
  const { json, autoConfirm } = opts;
  return async (
    offer: Offer,
    dustRequired: bigint,
  ): Promise<OfferConfirmationResult> => {
    const offerLines = [
      `Currency:  ${offer.offerCurrency}`,
      `Amount:    ${offer.offerAmount} ${offer.offerCurrency}`,
      `DUST:      ${formatDust(dustRequired)} specks`,
      `Expires:   ${offer.expiresAt.toLocaleTimeString()} (${
        formatTimeRemaining(offer.expiresAt)
      })`,
      `Offer ID:  ${offer.offerId}`,
    ].join("\n");

    if (autoConfirm) {
      if (!json) {
        p.note(offerLines, "Offer (auto-confirmed)");
      }
      return { status: "confirmed" };
    }

    if (json) {
      throw new Error(
        "Offer confirmation required in JSON mode. Provide --auto-confirm flag.",
      );
    }

    p.note(offerLines, "Offer received");

    const confirmed = await p.confirm({
      message: "Confirm this offer?",
    });

    if (p.isCancel(confirmed)) {
      return { status: "cancelled" };
    }

    return confirmed ? { status: "confirmed" } : { status: "back" };
  };
}
