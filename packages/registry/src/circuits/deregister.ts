import * as path from 'path';
import { fileURLToPath } from 'url';

import { AppContext, buildProviders, createLogger } from "@capacity-exchange/midnight-node";
import { toTxResult, TxResult } from '@capacity-exchange/midnight-core';
import { SecretKey } from "../types";
import { CompiledRegistryContract, createPrivateState, RegistryContract } from '../contract';
import { SucceedEntirely, type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { createUnprovenCallTx, submitTx } from "@midnight-ntwrk/midnight-js-contracts";
import { persistentHash, CompactTypeBytes, type CompactType } from '@midnight-ntwrk/compact-runtime';
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import type { Value, Alignment } from '@midnight-ntwrk/onchain-runtime-v3';

const logger = createLogger(import.meta);

type DeregisterServerProvider = MidnightProviders<'deregisterServer'>;
const circuitId = 'deregisterServer';


/** CompactType descriptor for Bytes<32> — copied from the index.js of registry contract */
const descriptor_1 = new CompactTypeBytes(32);

/** CompactType descriptor for Bytes<64> — copied from the index.js of registry contract */
const descriptor_0 = new CompactTypeBytes(64);

/**
 * In the generated contract, used as the input type for `persistentHash` in `hashKey`.
 */
const descriptor_12: CompactType<[Uint8Array, Uint8Array]> = {
    alignment(): Alignment { return descriptor_1.alignment().concat(descriptor_0.alignment()); },
    fromValue(value_0: Value): [Uint8Array, Uint8Array] {
        return [descriptor_1.fromValue(value_0), descriptor_0.fromValue(value_0)];
    },
    toValue(value_0: [Uint8Array, Uint8Array]): Value {
        return descriptor_1.toValue(value_0[0]).concat(descriptor_0.toValue(value_0[1]));
    },
};

/**
 * `pad(32, "registry:pkh")` from the registry contract, converted to bytes.
 * "registry:pkh" is 12 ASCII bytes zero-padded to 32 bytes.
 * Copied from `_hashKey_0` in the generated contract JS.
 */
const REGISTRY_PREFIX = new Uint8Array([
    114, 101, 103, 105, 115, 116, 114, 121, 58, 112, 107, 104, // "registry:pkh"
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // padding to 32 bytes
]);

export interface DeregisterParams {
    /** On-chain address of the deployed registry contract. */
    contractAddress: string;
    
    privateStateId: string;
    /**
     * 64-byte secret key that determines the on-chain registry key via `hashKey(secretKey())`.
     * Must match the key used when registering.
     */
    secretKey: SecretKey;
    /**
     * Bech32m-encoded unshielded address that will receive the collateral refund
     * sent by `sendUnshielded` in the `deregisterServer` circuit.
     */
    recipientAddress: string;
}

export async function deregister(ctx: AppContext, params: DeregisterParams): Promise<TxResult> {
    const { contractAddress, privateStateId, secretKey, recipientAddress } = params;

    logger.info(`Deregistering from registry ${contractAddress}...`);

    const contractOutDir = path.resolve(fileURLToPath(import.meta.url), '../../../contract/out');
    logger.debug(`Contract output directory: ${contractOutDir}`);

    const providers = buildProviders<RegistryContract>(ctx, contractOutDir);
    providers.privateStateProvider.setContractAddress(contractAddress);
    // Load the secret key into the private state provider so the `secretKey()` witness
    // has a value to read during circuit execution.
    logger.info(`Setting private state for privateStateId: ${privateStateId}`);
    await providers.privateStateProvider.set(privateStateId, createPrivateState(secretKey));

    const result = await submitUnprovedTransaction(
        providers as DeregisterServerProvider,
        params
    );

    return toTxResult(contractAddress, result);
}

/**
 * Builds, proves, and submits the `deregisterServer` call transaction.
 *
 * uses `sendUnshielded` since the contract pays the caller, 
 * so no unshielded offer is needed from the wallet side.
 */
async function submitUnprovedTransaction(
    providers: DeregisterServerProvider,
    params: DeregisterParams
) {
    const registerKey = computeRegistryKey(params.secretKey);
    logger.info(`Registry key: ${Buffer.from(registerKey).toString('hex')}`);

    const recipientAddress = parseAddress(params.recipientAddress);
    logger.info(`Recipient address: ${Buffer.from(recipientAddress.bytes).toString('hex')}`);

    const callTxData = await createUnprovenCallTx(providers as MidnightProviders<'deregisterServer'>, {
        contractAddress: params.contractAddress,
        compiledContract: CompiledRegistryContract,
        circuitId,
        privateStateId: params.privateStateId,
        args: [registerKey, recipientAddress],
    });

    const result = await submitTx(providers, {
        unprovenTx: callTxData.private.unprovenTx,
        circuitId,
    });

    if (result.status !== SucceedEntirely) {
        throw new Error(`${circuitId} transaction failed with status: ${result.status}`);
    }

    return result;
}

/**
 * Replicates the `hashKey` circuit to compute the 32-byte registry key
 * for a given secret key.
 */
function computeRegistryKey(secretKey: SecretKey): Uint8Array {
    return persistentHash(descriptor_12, [REGISTRY_PREFIX, secretKey]);
}

/**
 * Parses a Midnight bech32m address string into the `{ bytes: Uint8Array }`
 * to represent the `UserAddress` argument.
 */
function parseAddress(address: string): { bytes: Uint8Array } {
    return { bytes: new Uint8Array(MidnightBech32m.parse(address).data) };
}