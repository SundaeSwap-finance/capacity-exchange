# ces-fund

Funds a Cardano transaction with ADA bought from a Capacity Exchange, using a Dijkstra
**nested transaction** ([CIP-0118](https://github.com/cardano-foundation/CIPs/pull/862)).

The scenario: a wallet holds a native token and just enough ADA to keep that token's UTxO
alive. Every lovelace it owns is pinned as the minimum for an output it has to re-create, so
it cannot pay a fee and cannot transact at all. An exchange sells it the fee in exchange for
some of the token, delivered as a signed partial transaction that the caller splices into
their own.

## Why this tool exists

`cardano-cli` can *parse*, *sign*, *hash* and *submit* a nested transaction — its `dijkstra`
commands link the same ledger library the node runs. What it cannot do is **build** one: the
Dijkstra flag set is byte-identical to Conway's, and `debug transaction view` silently omits
body key 23. So this tool wraps `cardano-cli` for everything it does well and adds only the
two things it cannot do: assembling a sub-transaction, and displaying one.

## Setup

| Variable | Meaning | Default |
| --- | --- | --- |
| `CARDANO_CLI` | path to the `cardano-cli` binary | `cardano-cli` on `PATH` |
| `CARDANO_NODE_SOCKET_PATH` | node socket | required for node commands |
| `CARDANO_TESTNET_MAGIC` | network magic | `164` (Musashi) |
| `CES_FUND_WORK_DIR` | where intermediate artifacts are kept | `.ces-fund` |
| `CES_FUND_CLI_TIMEOUT` | seconds any single `cardano-cli` call may take | `120` |

Each has a matching flag (`--cardano-cli`, `--socket-path`, …) which takes precedence.

Only the caller needs a faucet drop; `mint` funds the stand-in exchange out of it.

```bash
export CARDANO_CLI=/path/to/cardano-cli
export CARDANO_NODE_SOCKET_PATH=/path/to/node.socket
```

## Flow

Every step names the file it consumes and prints the file it produces, so the chain is visible
rather than conventional. All artifacts land in the work directory (`.ces-fund` by default),
which is safe to delete between runs.

```bash
# 1. wallets (re-running leaves existing ones alone)
bun src/cli.ts init --caller-wallet ./caller \
  --simulated-ces-wallet ./simulated-ces --recipient-wallet ./recipient

# 2. fund the CALLER only, from the faucet. Then mint: this puts the token in the caller's
#    hands at exactly its minimum lovelace and sweeps the rest to the exchange, so one
#    faucet drop sets up both parties and leaves the caller unable to pay a fee.
bun src/cli.ts mint --caller-wallet ./caller \
  --sweep-to $(cat ./simulated-ces/payment.addr)

# 3. show that the caller cannot pay a fee                    -> selection.json
bun src/cli.ts balance --caller-wallet ./caller

# 4. build the unbalanced parent and work out the capacity    -> parent.draft.tx
#    Send less than the whole holding: the exchange is paid in this token out of the
#    caller's own change, so some has to stay behind.
bun src/cli.ts build --caller-wallet ./caller \
  --selection .ces-fund/selection.json \
  --send 98000000:<policyid><hexname> \
  --to $(cat ./recipient/payment.addr)

# 5. price discovery across exchanges — a real HTTP call      -> quote.json
#    The capacity asked for covers the fee AND the change output's minimum lovelace,
#    which the caller cannot fund either.
bun src/cli.ts quote --selection .ces-fund/selection.json \
  --ces-url https://ces-a.example --ces-url https://ces-b.example \
  --fee-estimate <capacity from step 4>

# 6. obtain the funding sub-transaction                       -> offer.json
bun src/cli.ts offer .ces-fund/quote.json --simulate-ces \
  --simulated-ces-signing-key ./simulated-ces/payment.skey

# 7. verify, merge, balance                                   -> parent.nested.tx
bun src/cli.ts splice --draft .ces-fund/parent.draft.tx \
  --quote .ces-fund/quote.json \
  --offer .ces-fund/offer.json \
  --selection .ces-fund/selection.json

# 8. sign, submit, confirm                             -> parent.nested.tx.signed
bun src/cli.ts sign .ces-fund/parent.nested.tx --caller-wallet ./caller
bun src/cli.ts submit .ces-fund/parent.nested.tx.signed --wait
bun src/cli.ts status --address $(cat ./recipient/payment.addr) \
  --address $(cat ./simulated-ces/payment.addr)
```

Each command also prints the next one with its paths already filled in, so you can follow the
chain without consulting this file.

`show` renders a bundle at any point, including the sub-transactions stock tooling hides:

```bash
bun src/cli.ts show .ces-fund/parent.nested.tx.signed
```

## Inclusion takes a few minutes

Submitting only puts a transaction in the mempool. On Musashi it has been observed to land
within about six minutes, so `submit` reports acceptance as *pending* and offers `--wait`:

```bash
bun src/cli.ts submit --wait                      # poll until it lands
bun src/cli.ts status --txid <txid> --wait        # or poll a transaction later
bun src/cli.ts status --txid <txid>               # included / pending / unknown
```

Plan a recording around this: run `init` and `mint` well before filming, since both are setup
and both wait on a block.

## What is real and what is simulated

The ADA-capacity offer route does not exist on the server yet, so `offer` has two modes and
**no default** — one of `--simulate-ces` or `--ces-url` must be given, so a recording can
never imply an exchange round trip that did not happen.

| Real | Simulated by `--simulate-ces` |
| --- | --- |
| `GET /api/prices` against live instances | choosing which UTxO to commit |
| the price formulas and quote IDs | locking it against concurrent offers |
| sub-transaction construction and signing | quote settlement and revenue accounting |
| every byte submitted to the node | |

The cryptography is real even in simulation, because it has to be: the node rejects a
sub-transaction whose signature does not verify against its own body hash.

## How it works

The caller's draft has two outputs: what they are sending, and change back to themselves.
The price is always taken from that change output, matched by address, so paying the exchange
never touches the tokens the recipient was promised. The caller cannot afford the change
output's minimum lovelace either, so the draft leaves it unfunded and the exchange releases it
alongside the fee. `build-raw` is given UTxO references rather than values, so it cannot object;
the bundle is balanced once, by `splice`.

A Dijkstra transaction body may carry `sub_transactions` at key 23, each one
`[sub_transaction_body, witness_set, auxiliary_data/nil]`. A sub-transaction body has no fee
and no collateral field, and `SUBUTXO` never checks value conservation — that happens once,
at the top level, over the parent and every sub-transaction summed together. So the exchange's
partial transaction deliberately does not balance: it releases exactly the lovelace the fee
needs, and absorbs the tokens that pay for it.

Because each sub-transaction's witnesses sign *its own* body hash, the exchange can sign an
offer without knowing the transaction that will eventually carry it, and the caller can splice
it in, rebuild their outputs and set the fee without invalidating that signature.

## Development

```bash
bun run typecheck   # tsc --noEmit
bun run test        # unit tests
```

The script is `typecheck` rather than `build` so it cannot be confused with the `build`
subcommand of the CLI itself.
