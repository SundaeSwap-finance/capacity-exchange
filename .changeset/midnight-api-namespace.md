---
'@sundaeswap/capacity-exchange-client': major
---

Midnight-specific routes move under `/api/midnight`, so the API reads cleanly for servers that don't use Midnight. `GET /api/prices` stays shared across chains.

- `POST /api/offers` is now `POST /api/midnight/offers`, `POST /api/ada/offers` is now `POST /api/midnight/ada/offers`, and `POST /api/sponsor` is now `POST /api/midnight/sponsor`. The methods `apiOffersPost`, `apiAdaOffersPost` and `apiSponsorPost` become `apiMidnightOffersPost`, `apiMidnightAdaOffersPost` and `apiMidnightSponsorPost`, and their request and response models are renamed to match (`ApiOffersPostRequest` becomes `ApiMidnightOffersPostRequest`, and so on).
- `GET /` replaces `env` with `chains`. `chains.midnight` holds `network`, `nodeUrl`, `indexerUrl`, `indexerWsUrl` and `proofServerUrl`, and is left out when the server has no Midnight network instead of reporting nulls. `node_ws_url` is gone, since it repeated `node_url`. A new `capacityAssets` field lists the assets the server sells.
- `GET /health/ready` leaves out `midnight` and `cardano` when that chain isn't configured, instead of reporting them as `disabled`. `disabled` is no longer a status.
- `GET /api/metrics` drops `server.network` and `health`. `dustUsage` and `contention` are replaced by `capacity`, which has one entry per capacity asset the server holds: `{ asset, available, consumedTotal, consumedLastHour, locksLastHour, contention: { lockedUtxos, totalUtxos, lockedAmount, ratio, averageRatioLastHour } }`. Amounts are in the asset's base unit.

The `/api/midnight/<xyz>` routes are temporarily aliased to `/api/<xyz>` to make rollout slightly easier, but this is undocumented and will be removed at our leisure.