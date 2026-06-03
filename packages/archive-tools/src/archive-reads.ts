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
 * Reads the per-contract pointer and the deploy record it points at. Throws with full s3
 * paths on miss so the caller can tell whether the pointer or the record is the gap.
 */
export async function loadCurrentDeployRecord(store: S3Store, contract: string): Promise<ContractDeployRecord> {
  const pointerKey = deploymentsKey.pointer({ contract });
  const pointer = fromJson<DeployPointer>(await store.getString(pointerKey));
  if (!pointer) {
    throw new Error(`pointer missing: s3://${store.bucket}/${pointerKey}`);
  }
  const recordKey = archiveKey.deploy({ sha: pointer.current.sha, contract, address: pointer.current.address });
  const record = fromJson<ContractDeployRecord>(await store.getString(recordKey));
  if (!record) {
    throw new Error(`deploy record missing: s3://${store.bucket}/${recordKey}`);
  }
  return record;
}
