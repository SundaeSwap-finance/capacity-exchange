import * as path from 'path';
import { fileURLToPath } from 'url';

import { AppContext, buildProviders, createLogger } from "@capacity-exchange/midnight-node";
import { RegistryKey } from '../types';
import { CompiledRegistryContract, createPrivateState, RegistryContract } from '../contract';
import { SucceedEntirely, type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { createUnprovenCallTx, submitTx } from "@midnight-ntwrk/midnight-js-contracts";
import { toTxResult, TxResult } from '@capacity-exchange/midnight-core';

const logger = createLogger(import.meta);

type RefreshValidityProvider = MidnightProviders<'refreshValidity'>;
const circuitId = 'refreshValidity';

export interface RefreshValidityParams {
    contractAddress: string;

    privateStateId: string;

    /**
     * New expiry as a Unix timestamp in seconds, passed directly to the `refreshValidity`
     * circuit as `UnixTimestampSeconds` (`Uint<64>`).
     */
    validToInt: bigint;

    /** New expiry date for the registry entry. Used only for logging. */
    validTo: Date;
}

/**
 * Extends the validity of an existing registry entry.
 *
 * Calls the `refreshValidity` circuit. The new timestamp must not
 * exceed `maximumValidityInterval` seconds from the current block time.
 *
 * @returns A {@link TxResult} with the transaction ID, hash, contract address, and block info.
 */
export async function refreshValidity(ctx: AppContext, secretKey: RegistryKey, params: RefreshValidityParams): Promise<TxResult> {
    const { contractAddress, privateStateId, validTo } = params;

    logger.info(`Refreshing validity to ${validTo.toISOString()} in registry ${contractAddress}...`);

    const contractOutDir = path.resolve(fileURLToPath(import.meta.url), '../../../contract/out');
    logger.debug(`Contract output directory: ${contractOutDir}`);

    const providers = buildProviders<RegistryContract>(ctx, contractOutDir);
    providers.privateStateProvider.setContractAddress(contractAddress);
    // Load the secret key into the private state provider so the `secretKey()` witness
    // has a value to read during circuit execution.
    await providers.privateStateProvider.set(privateStateId, createPrivateState(secretKey));

    const result = await submitUnprovedTransaction(
        providers as RefreshValidityProvider,
        params
    );

    return toTxResult(contractAddress, result);
}

/**
 * Unlike `registerServer`, this circuit does not call `receiveUnshielded`, so the
 * standard `submitTx` flow just works.
 */
async function submitUnprovedTransaction(
    providers: RefreshValidityProvider,
    params: RefreshValidityParams
) {
    const { contractAddress, privateStateId, validToInt } = params;

    const callTxData = await createUnprovenCallTx(providers, {
        contractAddress,
        compiledContract: CompiledRegistryContract,
        circuitId,
        privateStateId,
        args: [validToInt],
    });

    logger.info('Proving transaction...');
    const result = await submitTx(providers, {
        unprovenTx: callTxData.private.unprovenTx,
        circuitId,
    });

    if (result.status !== SucceedEntirely) {
        throw new Error(`${circuitId} transaction failed with status ${result.status}`);
    }

    return result;
}