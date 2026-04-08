import { requireNetworkId, withAppContext } from "@capacity-exchange/midnight-node";
import { program } from "commander";
import { listRegisteredServers } from "../list-registered-servers";
import { RegistryEntry, RegistryMapping } from "../types";


function main(): Promise<RegistryMapping> {
    program
    .name('list-servers')
    .description('Lists registered servers in the registry contract')
    .argument('<contractAddress>', 'address of the registry contract')
    .parse();

    const networkId = requireNetworkId();
    const [contractAddress] = program.args;

    return withAppContext(networkId, (ctx) => listRegisteredServers(ctx, contractAddress));
}