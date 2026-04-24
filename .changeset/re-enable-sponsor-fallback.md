---
'@capacity-exchange/server': minor
---

re-enable sponsor fallback
* peerCurrencySelector.ts (new): createAutoSelectCurrency (picks cheapest by offered/max ratio) + fixedCurrencySelector (pins one currency with allowlist/max/balance checks); shared selectFromCandidates helper
* peerPrice.ts + formulaIndex.ts (new): PeerPriceService reads operator-configured maxPrices ceilings
* peerOfferConfirmer.ts (new): auto-confirms offers below threshold
* cesWalletProvider.ts: CurrencySelection discriminated union (auto | fixed); auto-infers fixed when peer.maxPrices has exactly one entry
* peerCurrencySelector.test.ts (new): 14 unit tests across both selectors
