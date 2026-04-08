import * as crypto from 'crypto';

import { AppContext, buildProviders, createLogger } from "@capacity-exchange/midnight-node";
import { toTxResult } from '@capacity-exchange/midnight-core';
import { entryToContract, RegistryEntry, SecretKey } from "../types";
import { CompiledRegistryContract, createPrivateState, RegistryContract } from "../contract";

import { SucceedEntirely, type MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { createUnprovenCallTx, submitTx } from "@midnight-ntwrk/midnight-js-contracts";

const logger = createLogger(import.meta);

const circuitId = 'registerServer';

export interface RegisterParams {
    contractAddress: string;
    secretKey: SecretKey;
    entry: RegistryEntry;
}

interface SubmitRegisterTxParams {
    providers: MidnightProviders<'registerServer'>;
    contractAddress: string;
    entry: RegistryEntry;
}

export async function register(ctx: AppContext, params:RegisterParams) {
    const { contractAddress, secretKey, entry } = params;
    
    logger.info(`Registering ${params.entry.ip}:${entry.port} to registry ${contractAddress}...`);

    const providers = buildProviders<RegistryContract>(ctx, '../../contract/out');
    providers.privateStateProvider.setContractAddress(contractAddress);

    const result = await submitRegisterTx({ 
        providers: providers as MidnightProviders<`registerServer`>, 
        contractAddress, 
        entry 
    });

    if (result.status === SucceedEntirely) {
        logger.info(`Successfully registered ${params.entry.ip}:${entry.port} to registry ${contractAddress}`);
    } else {
        logger.error(`Failed to register ${params.entry.ip}:${entry.port} to registry ${contractAddress} with status: ${result.status}`);
    }

    return toTxResult(contractAddress, result);
}


async function submitRegisterTx(params: SubmitRegisterTxParams) {
    const { providers, contractAddress, entry } = params;

    providers.privateStateProvider.setContractAddress(contractAddress);

    const callTxData = await createUnprovenCallTx(providers, {
        contractAddress,
        compiledContract: CompiledRegistryContract,
        circuitId,
        privateStateId: crypto.randomBytes(32).toString('hex'),
        args: [entryToContract(entry)],
    });

    const result = await submitTx(providers, {
        unprovenTx: callTxData.private.unprovenTx,
        circuitId
    });


    if (result.status !== SucceedEntirely) {
        throw new Error(`RegisterServer transaction failed with status: ${result.status}`);
    }

  return result;
}