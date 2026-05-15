---
'@sundaeswap/capacity-exchange-providers': major
'@sundaeswap/capacity-exchange-registry': major
'@sundaeswap/capacity-exchange-nodejs': patch
'@capacity-exchange/server': minor
---

Registry stores bare domain names instead of IP+port; server URLs are resolved at connection time via DNS SRV records (`_capacityexchange._tcp.<domainName>`) using DNS-over-HTTPS.

**Breaking changes — `@sundaeswap/capacity-exchange-registry`:**
- `RegistryEntry.ip` and `RegistryEntry.port` removed; replaced by `RegistryEntry.domainName: DomainName`
- `IpAddress`, `IPv4`, `IPv6`, `ContractIpAddress` types removed
- `ipToContract` / `ipFromContract` removed; replaced by `domainNameToContract` / `domainNameFromContract`
- `register` CLI argument changed from `<ip> <port>` to `<domainname>`
- Contract redeployed for PREVIEW network: `takenSocketAddresses` → `takenDomainNames`; `Entry.ip`/`Entry.port` → `Entry.domainName`
- New exports: `DomainName`, `SrvName`, `SRV_SERVICE_PREFIX`, `toDomainName`, `toSrvName`

**Breaking changes — `@sundaeswap/capacity-exchange-providers`:**
- `fetchRegistryCesUrls` now resolves domain names via DoH SRV lookup instead of constructing URLs from stored IP+port