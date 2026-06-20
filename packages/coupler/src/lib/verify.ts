import { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { ledger } from './contract.js';

export interface VerifyOutput {
  contractAddress: string;
  lastS: string;
  lastHsp: string;
}

/** Read a coupling's disclosed cells, address-scoped at the tx's block. Not the
 *  state stream, whose first value can be another contract's state on a multi-contract
 *  tx. The block also pins the read before a later reveal overwrites. */
export async function verifyAtTx(ctx: AppContext, contractAddress: string, txId: string): Promise<VerifyOutput> {
  const { blockHeight } = await ctx.publicDataProvider.watchForTxData(txId);
  const state = await ctx.publicDataProvider.queryContractState(contractAddress, { type: 'blockHeight', blockHeight });
  if (!state) {
    throw new Error(`No state for ${contractAddress.slice(0, 16)} at block ${blockHeight}`);
  }
  const cells = ledger(state.data);
  return { contractAddress, lastS: uint8ArrayToHex(cells.lastS), lastHsp: uint8ArrayToHex(cells.lastHsp) };
}
