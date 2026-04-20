import { Alignment, CompactType, CompactTypeBytes, persistentHash, Value } from '@midnight-ntwrk/compact-runtime';
import { RegistryKey, RegistrySecretKey } from './types.js';

/** CompactType descriptor for Bytes<32> — copied from the index.js of registry contract */
const descriptor_1 = new CompactTypeBytes(32);

/** CompactType descriptor for Bytes<64> — copied from the index.js of registry contract */
const descriptor_0 = new CompactTypeBytes(64);

/**
 * In the registry contract, used as the input type for `persistentHash` in `hashKey`.
 */
const descriptor_12: CompactType<[Uint8Array, Uint8Array]> = {
  alignment(): Alignment {
    return descriptor_1.alignment().concat(descriptor_0.alignment());
  },
  fromValue(value_0: Value): [Uint8Array, Uint8Array] {
    return [descriptor_1.fromValue(value_0), descriptor_0.fromValue(value_0)];
  },
  toValue(value_0: [Uint8Array, Uint8Array]): Value {
    return descriptor_1.toValue(value_0[0]).concat(descriptor_0.toValue(value_0[1]));
  },
};

/**
 * `pad(32, "registry:pkh")` from the registry contract, converted to bytes.
 * Copied from `_hashKey_0` in the generated contract JS.
 */
const REGISTRY_PREFIX = new Uint8Array([
  114,
  101,
  103,
  105,
  115,
  116,
  114,
  121,
  58,
  112,
  107,
  104, // "registry:pkh"
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0, // padding to 32 bytes
]);

/**
 * Replicates the `hashKey` circuit to compute the 32-byte registry key
 */
export function computeRegistryKey(secretKey: RegistrySecretKey): RegistryKey {
  return persistentHash(descriptor_12, [REGISTRY_PREFIX, secretKey]);
}
