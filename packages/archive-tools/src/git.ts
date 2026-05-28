import { spawnSync } from 'child_process';

const REMOTE = 'origin';

/** Runs git in repoDir and returns trimmed stdout. Throws on non-zero exit. */
function git(repoDir: string, ...args: string[]): string {
  const r = spawnSync('git', ['-C', repoDir, ...args], { encoding: 'utf-8' });
  if (r.error) {
    throw r.error;
  }
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr.trim()}`);
  }
  return r.stdout.trim();
}

/** Absolute path to the git repo root containing startDir. */
export function gitRepoRoot(startDir: string): string {
  return git(startDir, 'rev-parse', '--show-toplevel');
}

/** Current HEAD sha of the repo at repoDir. */
export function gitHeadSha(repoDir: string): string {
  return git(repoDir, 'rev-parse', 'HEAD');
}

/** True if the repo has uncommitted changes in the index or working tree. */
export function isDirty(repoDir: string): boolean {
  return git(repoDir, 'status', '--porcelain') !== '';
}

/** Throws unless the sha is reachable from at least one remote branch. */
export function assertShaOnRemote(repoDir: string, sha: string): void {
  const branches = git(repoDir, 'branch', '--remotes', '--contains', sha);
  if (!branches) {
    throw new Error(`sourceSha ${sha} is not on any remote branch. Push the branch (and 'git fetch') then retry.`);
  }
}

/** GitHub <org>/<repo> slug for the origin remote. */
export function gitRemoteSlug(repoDir: string): string {
  const url = git(repoDir, 'remote', 'get-url', REMOTE);
  const httpsMatch = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return httpsMatch[1];
  }
  const sshMatch = url.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return sshMatch[1];
  }
  throw new Error(`remote '${REMOTE}' is not a GitHub URL: ${url}`);
}

/** Returns the sha the remote tag points at, or null if absent. */
function remoteTagSha(repoDir: string, tag: string): string | null {
  const out = git(repoDir, 'ls-remote', '--tags', REMOTE, `refs/tags/${tag}`);
  if (!out) {
    return null;
  }
  const sha = out.split(/\s+/)[0];
  return sha || null;
}

/**
 * Ensures the remote tag points at sha. Idempotent: a no-op if the remote tag already matches.
 * Throws without overwriting if the remote tag points at a different sha.
 */
export function pushTag(repoDir: string, tag: string, sha: string): void {
  const remoteSha = remoteTagSha(repoDir, tag);
  if (remoteSha === sha) {
    return;
  }
  if (remoteSha !== null) {
    throw new Error(
      `remote tag '${tag}' points at ${remoteSha}, expected ${sha}. Resolve the mismatch manually before retrying.`
    );
  }
  git(repoDir, 'tag', '--force', tag, sha);
  git(repoDir, 'push', REMOTE, tag);
}
