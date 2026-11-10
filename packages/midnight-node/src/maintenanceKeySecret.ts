import { sampleSigningKey, type SigningKey } from '@midnight-ntwrk/compact-runtime';
import type { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { createLogger } from './createLogger.js';

const logger = createLogger(import.meta);

// Loaded on first use, so tools that never touch Secrets Manager don't need AWS configured.
let client: SecretsManagerClient | undefined;
async function secretsManager() {
  const sdk = await import('@aws-sdk/client-secrets-manager');
  client ??= new sdk.SecretsManagerClient();
  return { sdk, client };
}

/** Fetches a plain-text secret by ARN or name. Credentials and region come from the usual AWS env/profile chain. */
export async function fetchSecretString(secretId: string): Promise<string> {
  const { sdk, client } = await secretsManager();
  const res = await client.send(new sdk.GetSecretValueCommand({ SecretId: secretId }));
  if (res.SecretString === undefined) {
    throw new Error(`Secret ${secretId} has no string value`);
  }
  return res.SecretString;
}

/** The tag that ties a maintenance key's secret to its contract; {@link findMaintenanceKeySecret} looks it up. */
const CONTRACT_ADDRESS_TAG = 'contractAddress';

const normalizeAddress = (address: string): string => address.trim().toLowerCase();

/**
 * Finds the secret holding a contract's maintenance signing key, by the contract address tag the
 * deploy put on it. Fails unless exactly one secret matches, so the wrong key is never used quietly.
 */
export async function findMaintenanceKeySecret(contractAddress: string): Promise<string> {
  const address = normalizeAddress(contractAddress);
  const { sdk, client } = await secretsManager();
  const matches: string[] = [];
  let nextToken: string | undefined;
  do {
    const res = await client.send(
      new sdk.ListSecretsCommand({
        Filters: [
          { Key: 'tag-key', Values: [CONTRACT_ADDRESS_TAG] },
          { Key: 'tag-value', Values: [address] },
        ],
        NextToken: nextToken,
      })
    );
    // The filters match keys and values separately (and by prefix), so check the exact pair here.
    for (const secret of res.SecretList ?? []) {
      if (secret.ARN && secret.Tags?.some((t) => t.Key === CONTRACT_ADDRESS_TAG && t.Value === address)) {
        matches.push(secret.ARN);
      }
    }
    nextToken = res.NextToken;
  } while (nextToken);

  if (matches.length === 0) {
    throw new Error(
      `No secret is tagged ${CONTRACT_ADDRESS_TAG}=${address}. Pass --signing-key-secret or --signing-key-file, ` +
        "or tag the secret that holds this contract's key"
    );
  }
  if (matches.length > 1) {
    throw new Error(`Several secrets are tagged ${CONTRACT_ADDRESS_TAG}=${address}: ${matches.join(', ')}`);
  }
  logger.info(`Using maintenance signing key from ${matches[0]}`);
  return matches[0];
}

export interface MaintenanceKey {
  signingKey: SigningKey;
  /** ARN of the secret holding `signingKey`; absent when it was not stored, or on a dry run. */
  secretArn?: string;
}

export interface SampleMaintenanceKeyOptions {
  /** Store the key in a new Secrets Manager secret before anything is submitted. */
  store: boolean;
  networkId: string;
  /** What is being deployed, e.g. `registry`; part of the secret's name and recorded as a tag. */
  contract: string;
  dryRun?: boolean;
}

/**
 * Names a new key's secret. Every deploy gets its own secret, since each deployed contract keeps its
 * own key for as long as it lives; rotate-verifier-keys finds it by contract address, not by name.
 */
function maintenanceKeySecretName(networkId: string, contract: string): string {
  // Secret names allow `/_+=.@-` but not `:`.
  const stamp = new Date()
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replace(/:/g, '-');
  return `capacity-exchange/${networkId}/maintenance-keys/${contract}/${stamp}`;
}

/**
 * Samples a contract maintenance signing key and, when `store` is set, saves it to a new Secrets
 * Manager secret (as the `{ "tag", "value" }` JSON rotate-verifier-keys reads) before anything is
 * submitted. If the deploy then fails, the worst case is an unused secret, never a deployed
 * contract whose key is lost. Call {@link recordDeployment} once the contract address is known.
 */
export async function sampleMaintenanceKey(options: SampleMaintenanceKeyOptions): Promise<MaintenanceKey> {
  const { store, networkId, contract, dryRun = false } = options;
  const signingKey = sampleSigningKey();
  if (!store) {
    return { signingKey };
  }
  const secretName = maintenanceKeySecretName(networkId, contract);
  if (dryRun) {
    logger.info(`[DRY RUN] Would store the maintenance signing key in secret ${secretName}`);
    return { signingKey };
  }
  const { sdk, client } = await secretsManager();
  // CreateSecret fails if the name exists, so an existing key is never overwritten.
  const res = await client.send(
    new sdk.CreateSecretCommand({
      Name: secretName,
      Description: `Maintenance signing key for a ${contract} contract on ${networkId} (deploy pending)`,
      SecretString: JSON.stringify({ tag: signingKey.tag, value: signingKey.value }),
      Tags: [
        { Key: 'network', Value: networkId },
        { Key: 'contract', Value: contract },
      ],
    })
  );
  if (!res.ARN) {
    throw new Error(`Secrets Manager did not return an ARN for ${secretName}`);
  }
  logger.info(`Stored maintenance signing key in ${res.ARN}`);
  return { signingKey, secretArn: res.ARN };
}

/** Records the deployed contract's address on the key's secret, so it can be found from either side. */
export async function recordDeployment(
  key: MaintenanceKey,
  deployment: { networkId: string; contract: string; contractAddress: string; txHash: string }
): Promise<void> {
  if (!key.secretArn) {
    return;
  }
  const { networkId, contract, contractAddress, txHash } = deployment;
  const { sdk, client } = await secretsManager();
  try {
    await client.send(
      new sdk.UpdateSecretCommand({
        SecretId: key.secretArn,
        Description: `Maintenance signing key for ${contract} contract ${contractAddress} on ${networkId} (deploy tx ${txHash})`,
      })
    );
    await client.send(
      new sdk.TagResourceCommand({
        SecretId: key.secretArn,
        Tags: [{ Key: CONTRACT_ADDRESS_TAG, Value: normalizeAddress(contractAddress) }],
      })
    );
  } catch (err) {
    // The key itself is already safe; only the bookkeeping failed. Don't fail a landed deploy over it.
    logger.warn(
      { err: err instanceof Error ? err : String(err) },
      `Could not record contract ${contractAddress} on secret ${key.secretArn}; ` +
        `tag it ${CONTRACT_ADDRESS_TAG}=${normalizeAddress(contractAddress)} by hand so rotate-verifier-keys can find it`
    );
  }
}

/**
 * Decides whether a deploy CLI stores its maintenance key, given `--no-maintenance-key-secret`.
 * Keys are stored by default everywhere but the local `undeployed` network, and mainnet refuses to
 * opt out: losing the key leaves the contract unmaintainable.
 */
export function shouldStoreMaintenanceKey(networkId: string, requested: boolean): boolean {
  if (networkId === 'mainnet' && !requested) {
    throw new Error('Mainnet deploys must store their maintenance signing key; drop --no-maintenance-key-secret');
  }
  if (networkId === 'undeployed') {
    return false;
  }
  if (!requested) {
    logger.warn("Not storing the maintenance signing key; it will only be in this command's output");
  }
  return requested;
}
