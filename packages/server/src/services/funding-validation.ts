import {
  ContractCall,
  type ContractAction,
  type Proofish,
  type Signaturish,
  type Bindingish,
  type Transaction,
} from '@midnight-ntwrk/ledger-v7';
import type { FundedContract } from '../models/config.js';

/**
 * Checks whether a contract action is allowed by the funded contracts config.
 * Only ContractCall actions can be funded; deploys and maintenance updates are rejected.
 */
function isActionFunded(action: ContractAction<Proofish>, config: FundedContract[]): boolean {
  if (!(action instanceof ContractCall)) {
    return false;
  }

  const entryPoint =
    action.entryPoint instanceof Uint8Array
      ? new TextDecoder().decode(action.entryPoint)
      : action.entryPoint;

  return config.some((fc) => {
    if (fc.contractAddress !== action.address) {
      return false;
    }
    if (fc.circuits.type === 'all') {
      return true;
    }

    return fc.circuits.circuitNames.includes(entryPoint);
  });
}

/**
 * A transaction is eligible IFF:
 * 1. It has at least one intent
 * 2. Every intent has at least one contract action
 * 3. Every contract action is a ContractCall to a funded contract/circuit
 */
export function validateFundedTx<S extends Signaturish, P extends Proofish, B extends Bindingish>(
  tx: Transaction<S, P, B>,
  fundedContracts: FundedContract[],
): boolean {
  const intents = tx.intents;
  if (!intents || intents.size === 0) {
    return false;
  }

  for (const [, intent] of intents) {
    const actions = intent.actions;
    if (actions.length === 0) {
      return false;
    }

    for (const action of actions) {
      if (!isActionFunded(action, fundedContracts)) {
        return false;
      }
    }
  }

  return true;
}
