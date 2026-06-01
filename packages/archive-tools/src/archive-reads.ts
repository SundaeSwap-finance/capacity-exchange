import { archiveKey } from './archive.js';
import { S3Store } from './aws/s3-store.js';

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
