# ces-fund

Funds a Cardano transfer with ADA bought from a Capacity Exchange, using a Dijkstra sub-transaction ([CIP-0118](https://github.com/cardano-foundation/CIPs/pull/862)) as a babel-fee offer, loosely following [CIP-0198](https://github.com/input-output-hk/babel-fees-aggregator/tree/main/CIP-0198).

The caller holds a token and only the ADA pinned as its UTxO's minimum, so it can't pay a fee. It signs an **offer**: a sub-transaction that pays the recipient and leaves some tokens behind in exchange for the ADA it's short. The exchange puts the offer in a **batch** (the top-level transaction), pays the fee, and submits it. The exchange owns the top-level transaction because sub-transactions can't carry a fee or collateral.

`cardano-cli` can sign, hash and submit Dijkstra transactions but can't build a sub-transaction, so this tool builds offers and splices them into batches, and wraps `cardano-cli` for everything else.

## Setup

| Variable                   | Meaning                        | Default                    |
| -------------------------- | ------------------------------ | -------------------------- |
| `CARDANO_CLI`              | `cardano-cli` binary           | `cardano-cli` on `PATH`    |
| `CARDANO_NODE_SOCKET_PATH` | node socket                    | required for node commands |
| `CARDANO_TESTNET_MAGIC`    | network magic                  | `164` (Musashi)            |
| `CES_FUND_WORK_DIR`        | intermediate artifacts         | `.ces-fund`                |
| `CES_FUND_CLI_TIMEOUT`     | seconds per `cardano-cli` call | `120`                      |

Each has a matching flag (`--cardano-cli`, `--socket-path`, …), which takes precedence.

## Flow

Each command prints the next one with its paths filled in. Only the caller needs a faucet drop; `mint` funds the stand-in exchange from it. Run `init` and `mint` well before recording, since both wait on a block.

```bash
# 1. wallets (existing ones are left alone)
bun src/cli.ts init --caller-wallet ./caller --simulated-ces-wallet ./simulated-ces --recipient-wallet ./recipient

# 2. after a faucet drop to the caller: mint the token, leaving the caller exactly its min-UTxO,
#    and sweep the spare ADA to the exchange
bun src/cli.ts mint --caller-wallet ./caller --sweep-to $(cat ./simulated-ces/payment.addr)

# 3. show the caller can't pay a fee                            -> selection.json
bun src/cli.ts balance --caller-wallet ./caller

# 4. draft the offer, before the price is known; prints the ADA  -> offer.draft.json
#    it needs (send less than the full holding: the price comes out of the change)
bun src/cli.ts build --selection .ces-fund/selection.json \
  --send 900000:<policyid><hexname> --to $(cat ./recipient/payment.addr)

# 5. price that ADA in tokens — a real call to GET /api/prices   -> quote.json
bun src/cli.ts quote --selection .ces-fund/selection.json --ces-url <url> --capacity <from step 4>

# 6. put the price into the offer (it comes out of the change),  -> offer.json
#    then sign; only now is the offer final
bun src/cli.ts commit --draft .ces-fund/offer.draft.json --quote .ces-fund/quote.json --caller-wallet ./caller

# 7. hand the offer to the exchange, which batches and submits   -> submission.json
bun src/cli.ts fund .ces-fund/offer.json --quote .ces-fund/quote.json \
  --simulate-ces --simulated-ces-wallet ./simulated-ces --wait

# 8. balances
bun src/cli.ts status --address $(cat ./recipient/payment.addr) --address $(cat ./simulated-ces/payment.addr)
```

Quotes expire (the server's `QUOTE_TTL_SECONDS`, 300 by default), so run steps 5–7 back to back.

`show .ces-fund/simulated-ces/batch.tx.signed` renders the batch, including the sub-transaction that `cardano-cli debug transaction view` omits. Run it before the batch lands; afterwards its inputs are spent and can't be resolved.

## Acceptance vs inclusion

As in CIP-0198, handing over an offer is asynchronous: a `202` only means the exchange will look at it. `fund` reports each stage using CIP-0198's names (received, verified, included-in-batch, submitted, or rejected with a reason code). With `--simulate-ces` they all happen within the one command; with `--ces-url` it polls.

The chain has the final say. An offer's ID is its own TxId, and the ledger stores its outputs under that ID, so `--wait` (or `status --offer <id> --wait`) watches for `<offer id>#0` directly.

## Real vs simulated

The offer route doesn't exist on the server yet, so `fund` requires exactly one of `--simulate-ces` or `--ces-url`, with no default. `--ces-url` would call `POST /api/babel/offers` and `GET /api/babel/offers/{id}`.

| Real                                         | Simulated by `--simulate-ces`               |
| -------------------------------------------- | ------------------------------------------- |
| `GET /api/prices` and its quote              | the exchange receiving the offer over HTTP  |
| the offer and the caller's signature         | choosing to carry it, and which UTxO to use |
| the batch, its fee, and everything submitted | quote settlement (expiry isn't checked)     |

## How it works

- **The offer doesn't balance.** It sends more tokens in than out (the price) and more lovelace out than in (the change output's minimum, which the caller can't fund). Dijkstra only checks conservation over the whole batch, so the exchange's input covers the lovelace and its change output collects the tokens.
- **The price goes in after the capacity is worked out.** The price only lowers the token amount in the change output, which can't make the offer bigger, so the ADA worked out from the draft still covers the signed offer. `commit` checks this before signing.
- **Capacity is the caller's own arithmetic:** the change output's minimum plus the ledger fee formula applied to the offer's signed size. The exchange covers the rest of the batch's fee from its margin, and `fund` prints the split.
- **The offer goes into the batch verbatim.** The caller's witness signs the offer's own body hash, so the exchange can build and sign the batch without breaking it, but re-encoding the offer could change that hash.
- **The batch lists the offer's inputs as reference inputs**, because the node only fetches UTxOs named at the top level.

## Open questions

- **Validity bound.** CIP-0198 requires offers to expire. Without a bound, anyone holding the offer can complete it, and the caller's UTxO stays committed until they spend it. It's untested whether Musashi accepts a validity interval in a sub-transaction, so offers here have none.
- **Tech stack.** This code is implementing the server side of the exchange via CLI scripts, we still need to determine how the real (TypeScript) implementation reads from and writes to the chain.

## Development

```bash
bun run typecheck   # tsc --noEmit (not `build`, to avoid confusion with the CLI's build command)
bun run test
```
