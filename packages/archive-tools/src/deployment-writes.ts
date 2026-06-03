import { archiveKey, asJson, fromJson } from './archive.js';
import {
  deploymentsKey,
  nextDeployPointer,
  type ContractDeployRecord,
  type DeployPointer,
  type DeployPointerEntry,
} from './deployments.js';
import { S3Store } from './aws/s3-store.js';

export type WriteRecordStatus = 'written' | 'skipped-identical' | 'conflict';

export interface WriteRecordResult {
  key: string;
  status: WriteRecordStatus;
}

/** Atomic conditional write. Returns 'skipped-identical' or 'conflict' if the key already exists. */
export async function writeRecord(
  store: S3Store,
  contract: string,
  record: ContractDeployRecord
): Promise<WriteRecordResult> {
  const key = archiveKey.deploy({ sha: record.sha, contract, address: record.address });
  const writeStatus = await store.putIfAbsent(key, ...asJson(record));
  if (writeStatus === 'written') {
    return { key, status: 'written' };
  }
  const existing = fromJson<ContractDeployRecord>(await store.get(key));
  if (existing && JSON.stringify(existing) === JSON.stringify(record)) {
    return { key, status: 'skipped-identical' };
  }
  return { key, status: 'conflict' };
}

export type WritePointerStatus = 'updated' | 'unchanged';

export interface WritePointerResult {
  key: string;
  status: WritePointerStatus;
  newCurrent: DeployPointerEntry;
}

/** Read-modify-write the pointer for the given contract. Idempotent on identical re-record. */
export async function writePointer(
  store: S3Store,
  contract: string,
  entry: DeployPointerEntry
): Promise<WritePointerResult> {
  const key = deploymentsKey.pointer({ contract });
  const existing = fromJson<DeployPointer>(await store.get(key));
  const updated = nextDeployPointer(existing, entry);
  if (existing && updated === existing) {
    return { key, status: 'unchanged', newCurrent: entry };
  }
  await store.put(key, ...asJson(updated));
  return { key, status: 'updated', newCurrent: entry };
}
