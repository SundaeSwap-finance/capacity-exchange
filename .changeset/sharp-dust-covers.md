---
"@capacity-exchange/server": patch
---

Fund the full fee of sponsored and exchanged transactions. Sponsorship now sizes its dust spend to cover the cost of the dust spend itself. DUST quotes now add an overhead for the fees an offer adds to the client's transaction, so clients without their own DUST can submit. The overhead is configured as `OFFER_FEE_OVERHEAD_UNITS` (default 6) multiples of the current fee of one shielded output, so it follows fee prices.
