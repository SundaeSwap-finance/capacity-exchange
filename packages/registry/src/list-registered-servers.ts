import * as path from 'path';
import { fileURLToPath } from 'url';
import { AppContext, buildProviders, createLogger } from "@capacity-exchange/midnight-node";
import { Registry } from "./contract";
import { entryFromContract, RegistryMapping } from "./types";

const logger = createLogger(import.meta);



export async function listRegisteredServers(ctx: AppContext, contractAddress: string): Promise<RegistryMapping> {
    logger.info(`Querying registered servers from registry ${contractAddress}...`);

    const contractOutDir = path.resolve(fileURLToPath(import.meta.url), '../../contract/out');
    const providers = buildProviders(ctx, contractOutDir);
    const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
    if (!contractState) {
        throw new Error(`Contract not found at address: ${contractAddress}`);
    }

    const ledgerState = Registry.ledger(contractState.data);
    const entries: RegistryMapping = new Map();

    logger.info('Registered servers:');
    for (const [key, value] of ledgerState.registry) {
        const entry = entryFromContract(value);
        const keyHex = Buffer.from(key).toString('hex');
        logger.info(`  key: ${keyHex}, ip: ${entry.ip.address}:${entry.port}, validTo: ${entry.validTo.toISOString()}`);
        entries.set(keyHex, entry);
    }

    return entries;
}