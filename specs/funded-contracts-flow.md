# Funded Contracts Flow

## Background

The Capacity Exchange allows liquidity providers (LPs) to sell their dust to users who need it for Midnight transaction fees. In the standard flow, users request a price quote from an LP, and the LP builds the necessary on-chain components for the dust transfer.

This spec covers a new flow: **Funded Contracts** which was requested by the Paima team. This flow should allow LPs to provide dust for transcations that only involve specific contracts at no cost.

## Problem Statement

The Paima team builds Web3 games, integrating blockchains. They want to allow users to play their games without any Blockchain wallet. Since those users have no blockchain wallet, they could not pay for the transaction fees, even with the existing flow.

## User Flows

### Standard Capacity Exchange (existing, for reference)

1. User needs dust to pay transaction fees
2. User requests a price from a CES (being run by an LP)
3. CES builds an intent which pays the dust and adds the ZSwap output.
4. User must then provide the ZSwap input and merge the intent into their transaction, before submitting.

### Funded Contract Flow (new)

1. User initates a transaction involves a "funded contract"
2. User submits their proven transaction to the CES.
3. CES validates that there are no intents invoking contracts that aren't "funded contracts"
4. CES provides dust to cover the whole transaction
5. CES merges the user's transaction with the dust transaction, which updates the pedersen commitment, ensuring they can't be separated.
6. CES returns the merged transaction.
7a. User can optionally merge this with another transaction, allowing users to have "partially funded" transactions. 
7b. User submits the final transaction.


## Key Components

### CES Configuration

A liquidity provider should be able to provide a list of contract addresses and specific circuit names that are considered "funded contracts". If there are none, the CES should not allow any transactions to follow this flow. 

### Transaction Validation

Since the user sent the raw bytes of the proven transaction, the CES can inspect the contract and specific circuit being executed in each intent. A transaction must not involve any non funded contracts in order to be funded.

### Client-Side Changes

In the standard flow, the user doesn't share the full transaction with the CES, just the quantity of dust needed. However, in order to ensure the LP is not paying for unrelated actions, the user must send the whole transaction to the CES here. Once the CES has merged the transaction, the user would receive the transaction so they can submit it.


### SDK Changes

In an attempt to ensure immediate interpoerability, the `capacityExchangeWalletProvider` should check how much dust a transaction is already spending, and subtract that amount from how much dust it will request from LPs. That would allow users to fund a transaction via the "funded contracts" flow, build another transaction doing some other action(s), merge it with the funded transaction, and use the "standard" flow to cover the additional cost.

## Security Considerations

### Preventing Exploitation

The concern is that a malicious user could take advantage of an LP who supports funded contracts, and trick the CES into providing dust for a transaction that could (eventually) include intents that don't involve the funded contracts. This is mitigated by the fact that the CES only estimates the cost of the intents which involve their funded contracts.

An attacker could intentionaly wait until a period of high traffic before requesting dust to cover an intent and, since the transaction fees are based on recent network load, the CES would include more dust. The attacker could potentially wait until a period of low traffic, and then add intents which are already covered by the greater dust amount. The `balanceTx` API takes a TTL within the `WalletProider` interface, so this risk could be reduced. Generally though, this is probably not worth worrying about in an initial implementation.

### Transaction Privacy

Once a transaction has been proven, the private inputs are erased. Therefore, the CES cannot read any private information they couldn't read from the transaction on-chain.

### Trust Model

While the specifics of a transaction are not available here, it is possible (depending on the context of the transaction) that just knowing which circuits are called reveals information that could give the LP an "unfair advantage". Therefore. the user must trust that the LP running the CES is unbiased and honest.

## Open Questions

None
