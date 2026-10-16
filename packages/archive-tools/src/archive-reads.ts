import { archiveKey, fromJson } from './archive.js';
import { S3Store } from './aws/s3-store.js';
import { deploymentsKey, type ContractDeployRecord, type DeployPointer } from './deployments.js';

/**
 * Refuses to proceed if the (sha, contract) archive is not present in the bucket.
 * A deploy record must point at compile outputs that actually exist, otherwise the
 * recorded sha is dangling. The check head-requests the archive's provenance.json marker.
 */
export async function verifyArchiveExists(store: S3Store, contract: string, sha: string): Promise<void> {
  const key = archiveKey.provenance({ sha, contract });
  if (!(await store.exists(key))) {
    throw new Error(
      `no archive found at s3 key '${key}'. Run archive-write for sha=${sha} contract=${contract} before recording its deploy.`
    );
  }
}

/**
 * Picks the deploy record key to use among `keys` (the listing under a contract's
 * `deploys/` prefix at `sha`). An env can deploy one compile more than once, for example
 * after a chain reset, and then its pointer names the live deploy. Pure.
 */
export function selectDeployKey(
  keys: string[],
  pointer: DeployPointer | null,
  contract: string,
  sha: string,
  bucket: string
): string {
  const records = keys.filter((key) => key.endsWith('.json'));
  if (records.length === 0) {
    throw new Error(
      `no deploy of ${contract} at sha=${sha} in bucket '${bucket}'. Deploy and record it with the contract deploy runbook first.`
    );
  }
  if (records.length === 1) {
    return records[0];
  }
  const current = pointer?.current;
  const pointed = current?.sha === sha ? archiveKey.deploy({ sha, contract, address: current.address }) : undefined;
  if (pointed && records.includes(pointed)) {
    return pointed;
  }
  throw new Error(
    `${records.length} deploys of ${contract} at sha=${sha} in bucket '${bucket}', and its pointer names none of them: ` +
      `${records.join(', ')}. Run point-deployment to name the live one.`
  );
}

/** Reads the env's deploy record of `contract` at compile `sha`, using the pointer only to choose among several. */
export async function loadDeployRecordAt(store: S3Store, contract: string, sha: string): Promise<ContractDeployRecord> {
  const prefix = `${archiveKey.prefix({ sha, contract })}/deploys/`;
  const keys = await store.listKeysUnder(prefix);
  const pointer =
    keys.length > 1 ? fromJson<DeployPointer>(await store.getString(deploymentsKey.pointer({ contract }))) : null;
  const key = selectDeployKey(keys, pointer, contract, sha, store.bucket);
  const record = fromJson<ContractDeployRecord>(await store.getString(key));
  if (!record) {
    throw new Error(`deploy record missing: s3://${store.bucket}/${key}`);
  }
  return record;
}
