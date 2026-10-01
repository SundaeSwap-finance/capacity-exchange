---
'@sundaeswap/capacity-exchange-providers': major
---

`ExchangeApi.apiOffersPost` and `ExchangeApi.apiSponsorPost` are renamed `apiMidnightOffersPost` and `apiMidnightSponsorPost`, and now call `/api/midnight/offers` and `/api/midnight/sponsor`. Use a server that serves those routes.
