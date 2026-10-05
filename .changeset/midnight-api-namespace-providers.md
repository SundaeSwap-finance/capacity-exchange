---
'@sundaeswap/capacity-exchange-providers': major
---

`ExchangeApi.apiPricesGet`, `ExchangeApi.apiOffersPost` and `ExchangeApi.apiSponsorPost` are renamed `apiMidnightPricesGet`, `apiMidnightOffersPost` and `apiMidnightSponsorPost`, and now call `/api/midnight/prices`, `/api/midnight/offers` and `/api/midnight/sponsor`. Use a server that serves those routes.
