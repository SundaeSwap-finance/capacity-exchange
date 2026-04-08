import * as fs from 'fs';
import { program } from "commander";
import type { RegistryEntry } from '../types.js';
import { register } from '../circuits/register';
import { requireNetworkId, runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { TxResult } from '@capacity-exchange/midnight-core';


function main(): Promise<TxResult> {
    program
     .name('register')
     .description('Registers a server to the registry contract')
     .argument('<contractAddress>', 'address of the registry contract')
     .argument('<registryKey>', 'hex-encoded registry key')
     .argument('<entryDetailsFile>', 'details of the registry entry as a JSON string')
     .parse();

    const networkId = requireNetworkId();

    const [contractAddress, registryKey, entryDetailsFile] = program.args;

    const secretKey = Buffer.from(registryKey, 'hex');

    const raw = JSON.parse(fs.readFileSync(entryDetailsFile, 'utf-8'));
    const entry: RegistryEntry = {
      ip: raw.ip,
      port: raw.port,
      validTo: new Date(raw.validTo),
    };

    return withAppContext(networkId, (ctx) => register(ctx, {
        contractAddress,
        secretKey,
        entry
    }));

}

runCli(main);