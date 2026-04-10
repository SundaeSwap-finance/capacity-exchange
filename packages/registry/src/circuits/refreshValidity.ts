import * as path from 'path';
import { fileURLToPath } from 'url';

import { AppContext, buildProviders, createLogger } from "@capacity-exchange/midnight-node";
import { SecretKey } from '../types';
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
    validTo: Date;
    validToInt: BigInt;
}

export async function refreshValidity(ctx: AppContext, secretKey: SecretKey, params: RefreshValidityParams): Promise<TxResult> {
    const { contractAddress, privateStateId, validTo, validToInt } = params;

    logger.info(`Refreshing validity to ${validTo.toISOString()} in registry ${contractAddress}...`);

    const contractOutDir = path.resolve(fileURLToPath(import.meta.url), '../../../contract/out');
    logger.debug(`Contract output directory: ${contractOutDir}`);

    const providers = buildProviders<RegistryContract>(ctx, contractOutDir);
    providers.privateStateProvider.setContractAddress(contractAddress);
    await providers.privateStateProvider.set(privateStateId, createPrivateState(secretKey));

    const result = await submitUnprovedTransaction(
        providers as RefreshValidityProvider,
        params
    );
   

    return toTxResult(contractAddress, result);
}

async function submitUnprovedTransaction(
    providers: RefreshValidityProvider,
    params: RefreshValidityParams
) {
    const {  contractAddress, privateStateId, validTo, validToInt } = params; 

    const callTxData = await createUnprovenCallTx(providers as RefreshValidityProvider, {
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