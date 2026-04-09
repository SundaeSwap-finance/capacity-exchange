import { requireNetworkId, withAppContext } from "@capacity-exchange/midnight-node";
import { program } from "commander";
import { listRegisteredServers } from "../list-registered-servers";


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