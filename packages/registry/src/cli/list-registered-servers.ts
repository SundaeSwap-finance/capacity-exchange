import { AppContext, buildProviders, createLogger, requireNetworkId, withAppContext } from "@capacity-exchange/midnight-node";
import { program } from "commander";
import path from "path";
import { fileURLToPath } from "url";
import { Registry } from "../contract";
import { RegistryMapping, entryFromContract } from "../types";

const logger = createLogger(import.meta);

async function listRegisteredServers(ctx: AppContext, contractAddress: string): Promise<RegistryMapping> {
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

async function main(): Promise<void> {
    program
    .name('list-servers')
    .description('Lists registered servers in the registry contract')
    .argument('<contractAddress>', 'address of the registry contract')
    .parse();

    const networkId = requireNetworkId();
    const [contractAddress] = program.args;

    const entries = await withAppContext(networkId, (ctx) => listRegisteredServers(ctx, contractAddress));

    const output: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
        output[key] = {
            ip: entry.ip,
            port: entry.port,
            validTo: entry.validTo.toISOString(),
        };
    }
    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
}

main().catch((err) => {
    console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    process.exit(1);
});