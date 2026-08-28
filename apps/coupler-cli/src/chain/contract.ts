import * as path from 'path';
import { fileURLToPath } from 'url';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { CouplerRawContract, witnesses, type CouplerContract } from '@sundaeswap/capacity-exchange-coupler/operations';

/** The coupler's compiled out dir, resolved through the package export so the harness finds it
 *  wherever the coupler is installed. */
const outContractEntry = fileURLToPath(
  import.meta.resolve('@sundaeswap/capacity-exchange-coupler/out/contract/index.js')
);
export const COUPLER_OUT_DIR = path.resolve(path.dirname(outContractEntry), '..');

export const CompiledCouplerContract = CompiledContract.make<CouplerContract>('Coupler', CouplerRawContract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(COUPLER_OUT_DIR)
);
