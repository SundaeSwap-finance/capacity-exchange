import { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { ledger } from './contract.js';

export interface VerifyOutput {
  contractAddress: string;
  lastS: string;
  lastHsp: string;
}

/** Read the disclosed cells (what the LP extracts to claim). */
export async function verify(ctx: AppContext, contractAddress: string): Promise<VerifyOutput> {
  const state = await ctx.publicDataProvider.queryContractState(contractAddress);
  if (!state) {
    throw new Error(`Contract not found at ${contractAddress}`);
  }
  const cells = ledger(state.data);
  return { contractAddress, lastS: uint8ArrayToHex(cells.lastS), lastHsp: uint8ArrayToHex(cells.lastHsp) };
}
