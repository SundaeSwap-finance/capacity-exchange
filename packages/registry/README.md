# @sundaeswap/capacity-exchange-registry

The registry is a contract acting as a directory of capacity exchange servers. Each entry maps a server's secret key (hashed on-chain) to a bare domain name and an expiry.

Clients discover servers by querying the registry for non-expired domain names and resolving each one via DNS SRV records (`_capacityexchange._tcp.<domainName>`) using DNS-over-HTTPS.

Servers must lock collateral to register, and get refunded after deregistering.

Entries expire after a configurable maximum period — expired entries can be removed by anyone to reclaim the collateral.

See the [../registry-node]() package for utilities to interact with the registry.