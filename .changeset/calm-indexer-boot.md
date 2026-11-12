---
"@capacity-exchange/server": patch
"@sundaeswap/capacity-exchange-client": minor
---

Handle various issues relating to instability/slowness from the Blockfrost indexer. The health endpoint now returns 503 until the indexer has given a healthy response. When polling, the service no longer calls the indexer if an earlier call is still in flight.