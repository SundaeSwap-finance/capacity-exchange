---
'@sundaeswap/capacity-exchange-nodejs': major
'@capacity-exchange/demo': patch
'@capacity-exchange/tests': patch
---

Converge env reads behind `resolveEnv()` + `requireEnvVar(env, name)`. Move `Env` type to new `env.js` module. Remove `requireNodeEnv` (use `requireEnvVar(process.env, name)`) and `requireNetworkId` (use `requireEnvVar(resolveEnv(), 'NETWORK_ID')`).
