---
'@sundaeswap/capacity-exchange-client': major
---

`GET /health/ready` groups its checks by chain. The Midnight `wallet` and `indexer` statuses move under `midnight`, and a new `cardano` field reports the Cardano tip the server follows over UTxO RPC. The models `HealthReadyGet200ResponseWallet` and `HealthReadyGet200ResponseIndexer` are renamed `HealthReadyGet200ResponseMidnightWallet` and `HealthReadyGet200ResponseMidnightIndexer`.
