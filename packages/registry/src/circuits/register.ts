import * as path from 'path';
import { fileURLToPath } from 'url';

import { AppContext, buildProviders, createLogger } from "@capacity-exchange/midnight-node";
import { buildMidnightProviders, DustWalletProvider, toTxResult } from '@capacity-exchange/midnight-core';
import { entryToContract, RegistryEntry, SecretKey } from "../types";
import { CompiledRegistryContract, createPrivateState, Registry, RegistryContract } from "../contract";

import { FinalizedTxData, SucceedEntirely, type MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { createUnprovenCallTx, submitCallTx } from "@midnight-ntwrk/midnight-js-contracts";
import { Intent, Transaction } from "@midnight-ntwrk/ledger-v8";

const logger = createLogger(import.meta);

const circuitId = 'registerServer';
const TTL_MS = 5 * 60 * 1000;

export interface RegisterParams {
    contractAddress: string;
    privateStateId: string;
    secretKey: SecretKey;
    entry: RegistryEntry;
}

interface SubmitRegisterTxParams {
    ctx: AppContext;
    providers: MidnightProviders<'registerServer'>;
    contractAddress: string;
    privateStateId: string;
    entry: RegistryEntry;
}

export async function register(ctx: AppContext, secretKey: SecretKey, params: RegisterParams) {
    const { contractAddress, privateStateId, entry } = params;

    logger.info(`Registering ${entry.ip.address}:${entry.port} to registry ${contractAddress}...`);

    const contractOutDir = path.resolve(fileURLToPath(import.meta.url), '../../../contract/out');
    logger.info(`Building providers with contract output directory: ${contractOutDir}`);

    const providers = buildProviders<RegistryContract>(ctx, contractOutDir);

    providers.privateStateProvider.setContractAddress(contractAddress);

    // Restore the private state so the `secretKey` witness is available during circuit execution
    await providers.privateStateProvider.set(privateStateId, createPrivateState(secretKey));

    
    const result = await submitRegisterTx({
        ctx,
        providers: providers as MidnightProviders<`registerServer`>,
        contractAddress,
        privateStateId,
        entry,
    });

    return toTxResult(contractAddress,result);
}

async function submitRegisterTx(params: SubmitRegisterTxParams) {
    const { ctx, providers, contractAddress, privateStateId, entry } = params;

    providers.privateStateProvider.setContractAddress(contractAddress);

    const callTxData = await createUnprovenCallTx(providers, {
        contractAddress,
        compiledContract: CompiledRegistryContract,
        circuitId,
        privateStateId,
        args: [entryToContract(entry)],
    });

   
    logger.info('Proving transaction (this may take several minutes)...');
    const provenTx = await providers.proofProvider.proveTx(callTxData.private.unprovenTx);

    const { walletFacade, keys } = ctx.walletContext;
    logger.info('Balancing transaction...');

    const ttl = new Date((new Date()).getTime() + 5 * 1000 * 60);
    const recipe = await walletFacade.balanceUnboundTransaction(
        provenTx,
        { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
        { ttl }
    );

    logger.info('Signing unshielded offer...');
    const signedRecipe = await walletFacade.signRecipe(recipe, (payload: Uint8Array) =>
        keys.unshieldedKeystore.signData(payload)
    );

    logger.info('Finalizing transaction...');
    const finalizedTx = await walletFacade.finalizeRecipe(signedRecipe);

    logger.info('Submitting transaction...');
    const txId = await ctx.midnightProvider.submitTx(finalizedTx);
    logger.info(`Transaction submitted: ${txId}`);

    logger.info('Waiting for confirmation...');
    const txData = await providers.publicDataProvider.watchForTxData(txId);

    if (txData.status !== SucceedEntirely) {
        throw new Error(`RegisterServer transaction failed with status: ${txData.status}`);
    }

    return txData;
}



function getWalletProvider(ctx: AppContext) {

    const { walletFacade, keys } = ctx.walletContext;

    const walletProvider = new DustWalletProvider(walletFacade, keys.shieldedSecretKeys, keys.dustSecretKey);

    return walletProvider;
}