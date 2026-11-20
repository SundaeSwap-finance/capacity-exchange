# ces-fund

Funds a Cardano transfer with ADA bought from a Capacity Exchange, using a Dijkstra sub-transaction ([CIP-0118](https://github.com/cardano-foundation/CIPs/pull/862)) as a babel-fee offer, loosely following [CIP-0198](https://github.com/input-output-hk/babel-fees-aggregator/tree/main/CIP-0198).

The caller holds a token and only the ADA pinned as its UTxO's minimum, so it can't pay a fee. It signs an **offer**: a sub-transaction that pays the recipient and leaves some tokens behind in exchange for the ADA it's short. The exchange (the capacity-exchange server, live at `https://babel-fees.musashi.sundae.fi`) puts the offer in a **batch** (the top-level transaction), pays the fee, and submits it. The exchange owns the top-level transaction because sub-transactions can't carry a fee or collateral.

`cardano-cli` can't build a sub-transaction, so this tool builds and signs offers itself, and wraps `cardano-cli` for chain queries and for minting.

## Setup

| Variable                   | Meaning                        | Default                    |
| -------------------------- | ------------------------------ | -------------------------- |
| `CARDANO_CLI`              | `cardano-cli` binary           | `cardano-cli` on `PATH`    |
| `CARDANO_NODE_SOCKET_PATH` | node socket                    | required for node commands |
| `CARDANO_TESTNET_MAGIC`    | network magic                  | `164` (Musashi)            |
| `CES_FUND_WORK_DIR`        | intermediate artifacts         | `.ces-fund`                |
| `CES_FUND_CLI_TIMEOUT`     | seconds per `cardano-cli` call | `120`                      |

Each has a matching flag (`--cardano-cli`, `--socket-path`, …), which takes precedence.

`cardano-cli` must understand Dijkstra (11.x). Without a local Musashi node, forward a remote node's socket over SSH, e.g. `ssh -fN -L ./node.sock:/opt/musashi/data/node.socket musashi-aws`. Socket paths are limited to about 100 bytes, so bind it somewhere short. Address queries can take a minute over a tunnel; raise `CES_FUND_CLI_TIMEOUT` if they time out.

Wallet signing keys may be plain (`PaymentSigningKeyShelley_ed25519`) or HD-derived (`PaymentExtendedSigningKeyShelley_ed25519_bip32`).

## Flow

Each command prints the next one with its paths filled in. Only the caller needs a faucet drop. Run `init` and `mint` well before recording, since `mint` waits on a block. The caller can also be any wallet that already holds a token the exchange accepts; skip steps 1 and 2 then.

```bash
# 1. wallets (existing ones are left alone)
bun src/cli.ts init --caller-wallet ./caller --recipient-wallet ./recipient

# 2. after a faucet drop to the caller: mint the token, leaving the caller exactly its min-UTxO,
#    and sweep the spare ADA to the recipient
bun src/cli.ts mint --caller-wallet ./caller --sweep-to $(cat ./recipient/payment.addr)

# 3. show the caller can't pay a fee                            -> selection.json
bun src/cli.ts balance --caller-wallet ./caller

# 4. draft the offer, before the price is known; prints the ADA  -> offer.draft.json
#    it needs (send less than the full holding: the price comes out of the change)
bun src/cli.ts build --selection .ces-fund/selection.json \
  --send 900000:<policyid><hexname> --to $(cat ./recipient/payment.addr)

# 5. price that ADA in tokens from the exchange's signed hints  -> quote.json
#    (GET /api/cardano/hints; the caller works the ladder out itself)
bun src/cli.ts quote --selection .ces-fund/selection.json \
  --ces-url https://babel-fees.musashi.sundae.fi --capacity <lovelace, from step 4>

# 6. put the price into the offer (it comes out of the change),  -> offer.json
#    then sign; only now is the offer final
bun src/cli.ts commit --draft .ces-fund/offer.draft.json --quote .ces-fund/quote.json --caller-wallet ./caller

# 7. hand the offer to the exchange that priced it, which         -> submission.json
#    batches and submits it; then follow the chain until it lands
bun src/cli.ts fund .ces-fund/offer.json --quote .ces-fund/quote.json --wait

# 8. balances
bun src/cli.ts status --address $(cat ./recipient/payment.addr) --address $(cat ./caller/payment.addr)
```

Hints are not a firm quote: the exchange reprices as its balance moves, so run steps 5–7 back to back.

`show-offer .ces-fund/offer.draft.json` (after step 4) or `show-offer .ces-fund/offer.json` (after step 6) renders the offer and its imbalance: what it leaves for the batch, and the ADA it needs from it. For the draft it also splits the capacity into the ADA needed and the fee share.

## Acceptance vs inclusion

CIP-0198 lets handing over an offer be asynchronous. The server is not: `POST /api/cardano/offers` takes the envelope's raw bytes as `application/cbor`, builds, signs and submits the batch, and only then answers `202 {offerId}`, or `400`/`500` with `{error, message}`, where `error` is a CIP-0198 reason code. It does not name the batch, and has no route to ask about an offer afterwards. `fund` reports what it learns using CIP-0198's names (submitted, or rejected with a reason code).

The chain has the final say. An offer's ID is its own TxId, and the ledger stores its outputs under that ID, so `--wait` (or `status --offer <id> --wait`) watches for `<offer id>#0` directly.

## Trust

`quote` checks the hints' signature against the issuer key they carry. That proves they are intact, not who issued them: hints here are unregistered, so trust in the key comes from the URL. The server does not yet check that an offer pays what its hints ask.

## How it works

- **The offer doesn't balance.** It sends more tokens in than out (the price) and more lovelace out than in (the change output's minimum, which the caller can't fund). Dijkstra only checks conservation over the whole batch, so the exchange's input covers the lovelace and its change output collects the tokens.
- **The price goes in after the capacity is worked out.** The price only lowers the token amount in the change output, which can't make the offer bigger, so the ADA worked out from the draft still covers the signed offer. `commit` checks this before signing.
- **Capacity is the caller's own arithmetic:** the change output's minimum plus the ledger fee formula applied to the offer's signed size. The exchange covers the rest of the batch's fee from its margin. `quote` prices that capacity up the hints' ladder: the price's base, plus each rung's rate for the lovelace it supplies, rounded up once.
- **The offer must reach the batch verbatim.** The caller's witness signs the offer's own body hash, so the exchange can build and sign the batch around it, but re-encoding the offer could change that hash. `fund` sends the envelope's exact bytes.

## Open questions

- **Validity bound.** CIP-0198 requires offers to expire. Without a bound, anyone holding the offer can complete it, and the caller's UTxO stays committed until they spend it. It's untested whether Musashi accepts a validity interval in a sub-transaction, so offers here have none.

## Development

```bash
bun run typecheck   # tsc --noEmit (not `build`, to avoid confusion with the CLI's build command)
bun run test
```
