---
'@sundaeswap/capacity-exchange-providers': minor
'@sundaeswap/capacity-exchange-react-sdk': minor
'@sundaeswap/capacity-exchange-client': minor
---

Make the API more generic over currencies sent and received. When a client calls the capacity exchange, they must explicitly request to receive DUST. The currencies returned by the exchange are now objects with a "type", instead of just an opaque string.
