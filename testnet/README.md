# Testnet

These files were copied from https://github.com/midnightntwrk/midnight-local-dev.

To bring up the testnet, run
```sh
docker compose -f standalone.yml up -d
```

To tear it down, run
```sh
docker compose -f standalone.yml down
```

The following seeds are pre-funded with 5 enormous NIGHT UTxOs and DUST:
 - 0000000000000000000000000000000000000000000000000000000000000001
 - 0000000000000000000000000000000000000000000000000000000000000002
 - 0000000000000000000000000000000000000000000000000000000000000003
 - a51c86de32d0791f7cffc3bdff1abd9bb54987f0ed5effc30c936dddbb9afd9d530c8db445e4f2d3ea42a321b260e022aadf05987c9a67ec7b6b6ca1d0593ec9

## Cardano

`cardano.yml` runs a single-pool Cardano devnet that starts in the Dijkstra era (network magic 42), with Dolos serving UTxO RPC on `localhost:50051`. Every `up` writes a fresh genesis, so the chain starts from block 0 each time.

```sh
docker compose -f cardano.yml up -d --wait
docker compose -f cardano.yml down
```

The key in `cardano/funded.skey` is pre-funded at `cardano/funded.addr`. To run cardano-cli against the node, use `docker exec cardano-devnet-node cardano-cli …`.

Run the Cardano integration tests with `task test:integ:cardano`. A transaction submitted through Dolos can take up to a minute to reach the node.
