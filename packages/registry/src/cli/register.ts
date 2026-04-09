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
     .argument('<secretKeyFile>', 'secret key file')
     .argument('<entryDetailsFile>', 'path to a JSON file with the registry entry details')
     .parse();

    const networkId = requireNetworkId();

    const [contractAddress, secretKeyFile, entryDetailsFile] = program.args;

    const privateKeys = JSON.parse(fs.readFileSync('.registry-private-keys.json', 'utf-8'));
    const privateStateId: string = privateKeys.privateStateId;

    const secretKey = new Uint8Array(Buffer.from(fs.readFileSync(secretKeyFile, 'utf-8').trim(), 'hex'));

    const raw = JSON.parse(fs.readFileSync(entryDetailsFile, 'utf-8'));

    const ipStr: string = typeof raw.ip === 'string' ? raw.ip : raw.ip.address;
    const entry: RegistryEntry = {
      ip: ipStr.includes(':')
        ? { kind: 'ipv6', address: ipStr }
        : { kind: 'ipv4', address: ipStr },
      port: raw.port,
      validTo: new Date(raw.validTo * 1000),
    };

    return withAppContext(networkId, (ctx) => register(ctx, secretKey, {
        contractAddress,
        privateStateId,
        secretKey,
        entry
    }));

}

runCli(main);