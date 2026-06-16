import { firstValueFrom } from 'rxjs';
import { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { ledger } from './contract.js';

export interface VerifyOutput {
  contractAddress: string;
  lastS: string;
  lastHsp: string;
}

/** Read the disclosed cells for a specific coupling tx (txId-keyed), so a later
 *  reveal cannot clobber them. The read the LP uses to extract s. */
export async function verifyAtTx(ctx: AppContext, contractAddress: string, txId: string): Promise<VerifyOutput> {
  const state = await firstValueFrom(
    ctx.publicDataProvider.contractStateObservable(contractAddress, { type: 'txId', txId, inclusive: true })
  );
  const cells = ledger(state.data);
  return { contractAddress, lastS: uint8ArrayToHex(cells.lastS), lastHsp: uint8ArrayToHex(cells.lastHsp) };
}
