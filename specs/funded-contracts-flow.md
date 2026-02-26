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
3. CES calcualtes the cost of ONLY intents which involve funded contracts.
4. CES provides the dust for the those intents, including some padding to cover the dust transaction/intent/utxo.
5. CES merges the user's transaction with the dust transaction, which updates the pedersen commitment, ensuring they can't be separated.
6. CES returns the merged transaction.
7. User submits the final transaction.


## Key Components

### CES Configuration

A liquidity provider should be able to provide a list of contract addresses that are considered "funded contracts". If there are none, the CES should not allow any transactions to follow this flow. 

### Transaction Validation

Since the user sent the raw bytes of the proven transaction, the CES can inspect the contract and specific circuit being executed in each intent. They would only provide dust to cover intents involving their funded contracts.

### Client-Side Changes

In the standard flow, the user doesn't share the full transaction with the CES, just the quantity of dust needed. However, in order to ensure the LP is not paying for unrelated actions, the user must send the whole transaction to the CES here. Once the CES has merged the transaction, the user would receive the transaction so they can submit it.

## Security Considerations

### Preventing Exploitation

The concern is that a malicious user could take advantage of an LP who supports funded contracts, and trick the CES into providing dust for a transaction that could (eventually) include intents that don't involve the funded contracts. This is mitigated by the fact that the CES only estimates the cost of the intents which involve their funded contracts.

An attacker could intentionaly wait until a period of high traffic before requesting dust to cover an intent and, since the transaction fees are based on recent network load, the CES would include more dust. The attacker could potentially wait until a period of low traffic, and then add intents which are already covered by the greater dust amount. This, however, is probably not worth worrying about in an initial implementation.

### Transaction Privacy

Once a transaction has been proven, the private inputs are erased. Therefore, the CES cannot read any private information they couldn't read from the transaction on-chain.

### Trust Model

There is no additional trust required with this flow.

## Open Questions

- Is it true that the proven transaction allows the CES to do everything it needs while preserving privacy?
