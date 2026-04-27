---
'@sundaeswap/capacity-exchange-nodejs': patch
'@sundaeswap/capacity-exchange-providers': patch
'@sundaeswap/capacity-exchange-react-sdk': patch
'@sundaeswap/capacity-exchange-registry': patch
'@capacity-exchange/demo-contracts': patch
'@capacity-exchange/demo': patch
'@capacity-exchange/server': patch
'@capacity-exchange/tests': patch
'@capacity-exchange/example-react-vite': patch
---

Use `workspace:*` for internal deps so bun always links the local package instead of fetching a stale published version.
