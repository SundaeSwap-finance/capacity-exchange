import { AppContext, buildProviders, createLogger } from "@capacity-exchange/midnight-node";
import { Registry } from "./contract";
import {  entryFromContract, RegistryEntry, RegistryMapping } from "./types";

const logger = createLogger(import.meta);



export async function listRegisteredServers(ctx: AppContext, contractAddress: string): Promise<RegistryMapping>   {
    logger.info(`Quewrying registered servers from registry from ${contractAddress}...`);

    const providers = buildProviders(ctx, '../../contract/out');
    const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
    if (!contractState) {
        throw new Error(`Contract not found at address: ${contractAddress}`);
    }

    const ledgerState = Registry.ledger(contractState.data);
    const entries = new Map();

    logger.info("Registered servers:");
    for (const [key, value] of ledgerState.registry) {
        const entry = entryFromContract(value);
        
        logger.info(`key: ${key}, entry: ${entry}`);

        entries.set(Buffer.from(key).toString('hex'), entry);
    } 

    return entries;

}