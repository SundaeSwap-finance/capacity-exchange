#!/usr/bin/env bun

import { spawnSync } from 'child_process';
import { mkdtempSync, readdirSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path';
import { program } from 'commander';
import { runCli, createLogger } from '@sundaeswap/capacity-exchange-nodejs';
import { archiveKey, asJson, COMPILE_OUTPUT_SUBDIRS, type Provenance } from '../archive.js';
import { S3Store } from '../aws/s3-store.js';
import { uploadDir } from '../aws/s3-fs.js';
import { assertShaOnRemote, gitHeadSha, gitRemoteSlug, gitRepoRoot, isDirty, pushTag } from '../git.js';

const logger = createLogger(import.meta);

interface CliOpts {
  bucket: string;
  contract: string;
  sourceFile: string;
}

interface DeriveProvenanceResult {
  repoDir: string;
  sourceFileAbs: string;
  provenance: Provenance;
}

interface CliResult {
  bucket: string;
  contract: string;
  keyPrefix: string;
  provenanceKey: string;
  uploadedKeys: number;
  sourceSha: string;
  sourceFile: string;
  sourceRepo: string;
  tag: string;
}

/** Invokes compactc on sourceFile, writing emitted artifacts under outDir. */
function runCompactc(sourceFile: string, outDir: string): void {
  const r = spawnSync('bunx', ['run-compactc', sourceFile, outDir], { stdio: 'inherit' });
  if (r.error) {
    throw r.error;
  }
  if (r.status !== 0) {
    throw new Error(`compactc failed (exit ${r.status})`);
  }
}

/** Configures commander and parses argv into CliOpts. */
function parseOpts(): CliOpts {
  program
    .name('archive-write')
    .description('Compile a Compact contract and upload its archive and provenance manifest to s3.')
    .requiredOption('--bucket <name>', 'Destination s3 bucket')
    .requiredOption('--contract <name>', 'Contract name in kebab-case (used as the s3 prefix under archive/<sha>/)')
    .requiredOption('--source-file <path>', 'Path to the .compact source (resolved against the cwd)')
    .parse();
  return program.opts<CliOpts>();
}

/** Resolves source path, finds the repo, builds Provenance. Refuses dirty trees or unpushed shas. */
function deriveProvenance(opts: CliOpts): DeriveProvenanceResult {
  const sourceFileAbs = realpathSync(isAbsolute(opts.sourceFile) ? opts.sourceFile : resolve(opts.sourceFile));
  const repoDir = gitRepoRoot(dirname(sourceFileAbs));
  if (isDirty(repoDir)) {
    throw new Error(`source repo at ${repoDir} is dirty. Commit or stash before archiving`);
  }
  const sourceSha = gitHeadSha(repoDir);
  assertShaOnRemote(repoDir, sourceSha);
  const sourceFile = relative(repoDir, sourceFileAbs).split(sep).join('/');
  const sourceRepo = gitRemoteSlug(repoDir);
  return {
    repoDir,
    sourceFileAbs,
    provenance: { sourceSha, sourceFile, sourceRepo },
  };
}

/**
 * Asserts compactc emitted only the canonical compile-output subdirs. Fails loud if a
 * new subdir appears so the read-side constant stays in sync with the writer's reality.
 */
function assertCanonicalLayout(tempDir: string): void {
  const canonical = new Set<string>(COMPILE_OUTPUT_SUBDIRS);
  const entries = readdirSync(tempDir, { withFileTypes: true });
  const unexpected = entries.filter((e) => !canonical.has(e.name)).map((e) => e.name);
  const nonDir = entries.filter((e) => canonical.has(e.name) && !e.isDirectory()).map((e) => e.name);
  const reasons: string[] = [];
  if (unexpected.length > 0) {
    reasons.push(
      `unexpected entries [${unexpected.join(', ')}]. Update COMPILE_OUTPUT_SUBDIRS in archive.ts and the readers that consume it.`
    );
  }
  if (nonDir.length > 0) {
    reasons.push(
      `canonical names that are not directories [${nonDir.join(', ')}]. Compactc should emit each as a directory.`
    );
  }
  if (reasons.length > 0) {
    throw new Error(`compactc output layout check failed: ${reasons.join(' ')}`);
  }
}

/** Compiles to temp dir, uploads provenance before artifacts so partial runs never leave artifacts unprovenanced. */
async function writeToStore(
  store: S3Store,
  keyPrefix: string,
  provenanceKey: string,
  sourceFileAbs: string,
  provenance: Provenance
): Promise<{ uploadedKeys: number }> {
  const tempDir = mkdtempSync(join(tmpdir(), 'archive-write-'));
  runCompactc(sourceFileAbs, tempDir);
  assertCanonicalLayout(tempDir);
  await store.put(provenanceKey, ...asJson(provenance));
  const uploadedKeys = await uploadDir(store, keyPrefix, tempDir);
  return { uploadedKeys: uploadedKeys.length };
}

/** Top-level orchestration: parse opts, derive provenance, upload archive, push tag. */
async function main(): Promise<CliResult> {
  const opts = parseOpts();
  const { repoDir, sourceFileAbs, provenance } = deriveProvenance(opts);
  const keyArgs = { sha: provenance.sourceSha, contract: opts.contract };
  const keyPrefix = archiveKey.prefix(keyArgs);
  const provenanceKey = archiveKey.provenance(keyArgs);
  const store = new S3Store({ bucket: opts.bucket });

  const { uploadedKeys } = await writeToStore(store, keyPrefix, provenanceKey, sourceFileAbs, provenance);
  const tag = archiveKey.tag({ sha: provenance.sourceSha });
  try {
    pushTag(repoDir, tag, provenance.sourceSha);
  } catch (err) {
    throw new Error(
      `s3 upload succeeded under ${keyPrefix} but tag push failed. Re-run to retry: ${(err as Error).message}`
    );
  }

  logger.info(
    { bucket: opts.bucket, contract: opts.contract, keyPrefix, provenanceKey, uploadedKeys, tag },
    'archive written'
  );

  return {
    bucket: opts.bucket,
    contract: opts.contract,
    keyPrefix,
    provenanceKey,
    uploadedKeys,
    ...provenance,
    tag,
  };
}

runCli(main);
