# @sundaeswap/capacity-exchange-client

## 2.0.0

### Major Changes

- db38193: Midnight-specific routes move under `/api/midnight`, so the API reads cleanly for servers that don't use Midnight.
  
  - `POST /api/offers` is now `POST /api/midnight/offers`, `POST /api/ada/offers` is now `POST /api/midnight/ada/offers`, and `POST /api/sponsor` is now `POST /api/midnight/sponsor`. The methods `apiOffersPost`, `apiAdaOffersPost` and `apiSponsorPost` become `apiMidnightOffersPost`, `apiMidnightAdaOffersPost` and `apiMidnightSponsorPost`, and their request and response models are renamed to match (`ApiOffersPostRequest` becomes `ApiMidnightOffersPostRequest`, and so on).
  - Prices are quoted per chain. `apiPricesGet` (`GET /api/prices?currency=&amount=`) is replaced by `apiMidnightPricesGet` (`GET /api/midnight/prices?amount=`, for DUST) and `apiCardanoPricesGet` (`GET /api/cardano/prices?amount=`, for ADA). `ApiPricesGetCurrencyEnum` is gone. The shared models are renamed `PricesResponse`, `Price`, `Currency` and `ErrorResponse`, replacing `ApiPricesGet200Response`, `ApiPricesGet200ResponsePricesInner`, `ApiPricesGet200ResponsePricesInnerCurrency` and `ApiPricesGet400Response`.
  - `GET /` replaces `env` with `chains`. `chains.midnight` holds `network`, `nodeUrl`, `indexerUrl`, `indexerWsUrl` and `proofServerUrl`, and is left out when the server has no Midnight network instead of reporting nulls. `node_ws_url` is gone, since it repeated `node_url`. A new `capacityAssets` field lists the assets the server sells.
  - `GET /health/ready` leaves out `midnight` and `cardano` when that chain isn't configured, instead of reporting them as `disabled`. `disabled` is no longer a status.
  - `GET /api/metrics` drops `server.network` and `health`. `dustUsage` and `contention` are replaced by `capacity`, which has one entry per capacity asset the server holds: `{ asset, available, consumedTotal, consumedLastHour, locksLastHour, contention: { lockedUtxos, totalUtxos, lockedAmount, ratio, averageRatioLastHour } }`. Amounts are in the asset's base unit.
  
  The `/api/midnight/<xyz>` routes are temporarily aliased to `/api/<xyz>` to make rollout slightly easier, but this is undocumented and will be removed at our leisure.
- ddcd80c: `GET /health/ready` groups its checks by chain. The Midnight `wallet` and `indexer` statuses move under `midnight`, and a new `cardano` field reports the Cardano tip the server follows over UTxO RPC. The models `HealthReadyGet200ResponseWallet` and `HealthReadyGet200ResponseIndexer` are renamed `HealthReadyGet200ResponseMidnightWallet` and `HealthReadyGet200ResponseMidnightIndexer`.

## 1.2.2

### Patch Changes

- c3f36f9: Update CI to bump versions as needed

## 1.2.1

### Patch Changes

- 0f612a3: Reference latest versions of internal modules

## 1.2.0

### Minor Changes

- 6b97231: Upgrade midnight dependencies to latest preprod versions.
  Fix import style to work on npm without bundling.

### Patch Changes

- 571226c: Add bun-specific exports of uncompiled TS code

## 1.1.0

### Minor Changes

- 2027d29: Improve APIs for easier dApp integration.
