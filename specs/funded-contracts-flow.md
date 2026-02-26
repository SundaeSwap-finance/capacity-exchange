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
2. User submits their unencrypted transaction to the CES. TODO: figure out what "unencrypted actually means here"
3. CES validates the transaction only includes supported contracts
4. CES provides the dust for the tranasction
5. CES finalizes the transaction, ensuring it cannot be modified any further. TODO: make sure this is actually possible
6. CES returns the completed transaction to the user
7. User submits the final transaction


## Key Components

### CES Configuration

A liquidity provider should be able to provide a list of contract addresses that are considered "funded contracts". If there are none, the CES should not allow any transactions to follow this flow. 

### Transaction Validation

Since the user sent the raw bytes of the unfinalized transaction, the CES can inspect the transaction to confirm what intents are included. From there, building and submitting the transaction would use the same APIs we use currently.

### Client-Side Changes

In the standard flow, the user doesn't share the full transaction with the CES, just the quantity of dust needed. However, in order to ensure the LP is not paying for unrelated actions, the user must send the whole transaction to the CES here. Once the CES has finalized the transaction, the user would receive the transaction so they can submit it.

## Security Considerations

### Preventing Exploitation

The concern is that a malicious user could take advantage of an LP who supports funded contracts, and trick the CES into providing dust for a transaction that would (eventually) include intents that don't involve the funded contracts.

This is seemingly mitigated by the fact that the user shares an unencrypted transaction with the CES. With those bytes, the CES can confirm that the transaction only invovles actions that it should fund. Then, since it is "finalized" the malicious user cannot modify the transaction to include other intents, though this needs to be confirmed. If this is not true, the flow should change to the CES submitting the transaction, and returning the response to the user.

### Transaction Privacy

The user is sending an unencrypted transaction to the CES, which allows the CES to read everything in the transaction. This is a violation of privacy, but may be acceptable in the context of games, where the CES is an unbiased third party.

### Trust Model

- The user must trust the LP to not reveal the contents of the transaction
- In the case that the CES submits the transaction, the user must also trust the LP to be honest about the the transaction that was submitted AND the state of the submission

## Open Questions

- Can a single transaction mix funded and unfunded contract calls?
- Is it possible to prevent modifications to a transaction (including merges?)
- Would it be possible to prove the transaction ONLY contains certain contracts without revealing the actual details of the transaction?
