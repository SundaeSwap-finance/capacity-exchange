---
'@capacity-exchange/server': minor
'@sundaeswap/capacity-exchange-providers': minor
'@sundaeswap/capacity-exchange-react-sdk': minor
---

re-enable sponsor fallback

* `peerCurrencySelector.ts`: `createAutoSelectCurrency` picks the cheapest eligible offer by `offered/max` ratio across all configured currencies; 
* `peerPrice.ts`: `PeerPriceService` reads operator-configured `maxPrices` ceilings; gracefully disabled (null) when `peer.maxPrices` is absent
* `peerOfferConfirmer.ts`: auto-confirms every offer below threshold
* `cesWalletProvider.ts`: accepts a pre-built `PromptForCurrency`; selection strategy is wired by the plugin, not the builder
* `ces-wallet-provider.ts`: peer fallback gracefully disabled when `PeerPriceService` is null; uses `indexerChainStateProvider` from providers package