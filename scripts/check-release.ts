#!/usr/bin/env bun

import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';

const rootDir = new URL('..', import.meta.url).pathname;
const git = (...args: string[]) => execFileSync('git', ['-C', rootDir, ...args], { encoding: 'utf-8' });
const readJson = (file: string) => JSON.parse(readFileSync(join(rootDir, file), 'utf-8'));

const base = git('merge-base', 'HEAD', 'origin/main').trim();
const changed = [git('diff', '--name-only', base), git('ls-files', '--others', '--exclude-standard')]
  .flatMap((output) => output.split('\n'))
  .filter((file) => file !== '');

const dirs: string[] = readJson('package.json').workspaces.flatMap((pattern: string) => {
  if (!pattern.endsWith('/*')) {
    return [pattern];
  }
  const parent = pattern.slice(0, -2);
  return readdirSync(join(rootDir, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${parent}/${entry.name}`);
});

const published = dirs
  .filter((dir) => existsSync(join(rootDir, dir, 'package.json')))
  .map((dir) => ({ dir, manifest: readJson(`${dir}/package.json`) }))
  .filter(({ manifest }) => manifest.private !== true)
  .map(({ dir, manifest }) => ({
    name: manifest.name as string,
    files: changed.filter((file) => file.startsWith(`${dir}/`)),
  }))
  .filter((pkg) => pkg.files.length > 0);

const named = new Set<string>();
for (const file of changed) {
  const isChangeset = file.startsWith('.changeset/') && file.endsWith('.md') && basename(file) !== 'README.md';
  if (!isChangeset || !existsSync(join(rootDir, file))) {
    continue;
  }
  const frontmatter = readFileSync(join(rootDir, file), 'utf-8').split('---')[1] ?? '';
  for (const line of frontmatter.split('\n')) {
    const release = /^\s*(['"]?)(.+?)\1\s*:\s*(major|minor|patch)\s*$/.exec(line);
    if (release) {
      named.add(release[2]);
    }
  }
}

const uncovered = published.filter((pkg) => !named.has(pkg.name));

if (uncovered.length === 0) {
  const covered = published.map((pkg) => pkg.name).join(', ');
  console.log(
    covered
      ? `Every changed published package is named in a changeset: ${covered}`
      : `No published package has changed since ${base}.`
  );
  process.exit(0);
}

console.log(`These published packages changed since ${base} and no changeset added since then names them:\n`);
for (const pkg of uncovered) {
  console.log(`  ${pkg.name}`);
  for (const file of pkg.files) {
    console.log(`    ${file}`);
  }
}
console.log('\nRun bun run changeset and name each package above.');

process.exit(1);
