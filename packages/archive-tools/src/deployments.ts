/** Immutable per-deploy record. One per (sha, contract, address) tuple. */
export interface ContractDeployRecord {
  address: string;
  txHash: string;
  sha: string;
  network: string;
  public: Record<string, unknown>;
}

/** Pointer entry shared by `current` and elements of `history`. */
export interface DeployPointerEntry {
  address: string;
  sha: string;
}

/** Per-contract mutable pointer. Names the current deploy plus prior history. */
export interface DeployPointer {
  current: DeployPointerEntry;
  history: DeployPointerEntry[];
}

/** Source-agnostic input from which a ContractDeployRecord can be built. */
export interface DeploymentInput {
  address: string;
  txHash: string;
  sourceSha: string;
  publicPayload: Record<string, unknown>;
}

/** Pure record builder. No IO. */
export function toDeployRecord(input: DeploymentInput, network: string): ContractDeployRecord {
  return {
    address: input.address,
    txHash: input.txHash,
    sha: input.sourceSha,
    network,
    public: input.publicPayload,
  };
}

/** S3 keys under the `deployments/` prefix. */
export const deploymentsKey = {
  pointer: ({ contract }: { contract: string }) => `deployments/${contract}.json`,
};

/**
 * Returns the next pointer with `entry` as current. If the prior `current` matches `entry`,
 * the existing pointer is returned unchanged (idempotent re-record). Otherwise the prior
 * current is appended to history.
 */
export function nextDeployPointer(existing: DeployPointer | null, entry: DeployPointerEntry): DeployPointer {
  if (!existing) {
    return { current: entry, history: [] };
  }
  if (existing.current.sha === entry.sha && existing.current.address === entry.address) {
    return existing;
  }
  return { current: entry, history: [...existing.history, existing.current] };
}
