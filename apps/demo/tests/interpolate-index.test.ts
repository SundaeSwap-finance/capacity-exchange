import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, watch, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../scripts/interpolate-index.ts', import.meta.url));
const PLACEHOLDER_HTML = '<script>window.__APP_CONFIG__ = @@APP_CONFIG@@;</script>\n';

interface Run {
  status: number;
  stderr: string;
  index: string;
  indexPath: string;
  dist: string;
}

/** Lays out a dist dir with the given page and returns its paths. */
function dist(html: string = PLACEHOLDER_HTML): { dist: string; indexPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'interpolate-index-'));
  const distDir = join(dir, 'dist');
  mkdirSync(distDir);
  const indexPath = join(distDir, 'index.html');
  writeFileSync(indexPath, html);
  // The mode vite emits, so the assertions below pin preservation rather than a constant.
  chmodSync(indexPath, 0o644);
  return { dist: distDir, indexPath };
}

/** Lays out a dist dir, runs the real script for a network id, returns its result. */
function run(networkId: string, html: string = PLACEHOLDER_HTML): Run {
  const laid = dist(html);
  const r = spawnSync(SCRIPT, ['--network-id', networkId, '--dist', laid.dist], { encoding: 'utf-8' });
  return {
    status: r.status ?? -1,
    stderr: r.stderr,
    index: readFileSync(laid.indexPath, 'utf-8'),
    indexPath: laid.indexPath,
    dist: laid.dist,
  };
}

/** Pulls the inlined object back out of the interpolated html. */
function inlined(index: string): unknown {
  const match = index.match(/window\.__APP_CONFIG__ = (.*);<\/script>/);
  if (!match) {
    throw new Error(`no inlined config found in: ${index}`);
  }
  return JSON.parse(match[1]);
}

// Restated so the cases are static. The drift test at the end holds it to the CLI.
const NETWORK_IDS = ['undeployed', 'preview', 'preprod', 'mainnet'];

describe('interpolate-index.ts', () => {
  it.each(NETWORK_IDS)('inlines a config carrying just the network id for %s', (networkId) => {
    const r = run(networkId);
    expect(r.status).toBe(0);
    expect(r.index).not.toContain('@@APP_CONFIG@@');
    expect(inlined(r.index)).toEqual({ networkId });
  });

  // The form deploy-demo.sh in the infra repo uses. Run here so a change to the
  // shebang or the file mode cannot break the deploy without reddening a test.
  it('runs under an explicit bun interpreter, the way the deploy invokes it', () => {
    const laid = dist();
    const r = spawnSync('bun', [SCRIPT, '--network-id', 'preprod', '--dist', laid.dist], { encoding: 'utf-8' });
    expect(r.status).toBe(0);
    expect(inlined(readFileSync(laid.indexPath, 'utf-8'))).toEqual({ networkId: 'preprod' });
  });

  // 0600 rather than a default, because a fresh file under the usual umask is already
  // 0644, so pinning that would pass against an implementation that preserves nothing.
  it('keeps the mode of the file vite built, so a later step can still read it', () => {
    const laid = dist();
    chmodSync(laid.indexPath, 0o600);
    const r = spawnSync(SCRIPT, ['--network-id', 'preview', '--dist', laid.dist], { encoding: 'utf-8' });
    expect(r.status).toBe(0);
    expect(statSync(laid.indexPath).mode & 0o777).toBe(0o600);
  });

  // A rename swaps in a new inode, an in-place write keeps the old one. Pinning that
  // is what stops the write becoming non-atomic, which would let a crash mid-write
  // leave a half-filled page in the dist the deploy uploads.
  it('replaces the file by rename rather than writing over it in place', () => {
    const laid = dist();
    const before = statSync(laid.indexPath).ino;
    const r = spawnSync(SCRIPT, ['--network-id', 'preview', '--dist', laid.dist], { encoding: 'utf-8' });
    expect(r.status).toBe(0);
    expect(statSync(laid.indexPath).ino).not.toBe(before);
  });

  it('leaves the page untouched and no temp behind when the write cannot land', () => {
    const laid = dist();
    const before = readFileSync(laid.indexPath, 'utf-8');
    chmodSync(laid.dist, 0o500);
    const r = spawnSync(SCRIPT, ['--network-id', 'preview', '--dist', laid.dist], { encoding: 'utf-8' });
    chmodSync(laid.dist, 0o700);
    expect(r.status).not.toBe(0);
    expect(r.stderr).not.toMatch(/Already interpolated/);
    expect(readFileSync(laid.indexPath, 'utf-8')).toBe(before);
    expect(readdirSync(laid.dist)).toEqual(['index.html']);
  });

  it('leaves no temp file behind in the dist it writes into', () => {
    const r = run('preview');
    expect(r.status).toBe(0);
    expect(readdirSync(r.dist)).toEqual(['index.html']);
  });

  // A directory where index.html should be reads as EISDIR, not ENOENT.
  it('reports a read failure as itself rather than as a missing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'interpolate-index-'));
    mkdirSync(join(dir, 'dist'));
    mkdirSync(join(dir, 'dist', 'index.html'));
    const r = spawnSync(SCRIPT, ['--network-id', 'preview', '--dist', join(dir, 'dist')], { encoding: 'utf-8' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).not.toMatch(/missing index file/);
  });

  it('fails loud when the placeholder is already gone', () => {
    const r = run('preview', '<script>window.__APP_CONFIG__ = {};</script>\n');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/no @@APP_CONFIG@@ placeholder/);
  });

  // Rejected here rather than in the browser, because a bundle that ships an id
  // parseAppConfig will not take is a blank demo nobody sees until it is live.
  it('rejects a network id the app would refuse, naming the ones it takes', () => {
    const r = run('testnet');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/testnet/);
    expect(r.stderr).toMatch(/preview/);
    expect(r.index).toContain('@@APP_CONFIG@@');
  });

  it('rejects an empty network id rather than inlining nothing', () => {
    const r = run('');
    expect(r.status).not.toBe(0);
    expect(r.index).toContain('@@APP_CONFIG@@');
  });

  it('fails loud when no network id is given at all', () => {
    const laid = dist();
    const r = spawnSync(SCRIPT, ['--dist', laid.dist], { encoding: 'utf-8' });
    expect(r.status).not.toBe(0);
    expect(readFileSync(laid.indexPath, 'utf-8')).toContain('@@APP_CONFIG@@');
  });

  it('fails loud when the index file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'interpolate-index-'));
    const distDir = join(dir, 'dist');
    mkdirSync(distDir);
    const r = spawnSync(SCRIPT, ['--network-id', 'preview', '--dist', distDir], { encoding: 'utf-8' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/missing index file/);
  });

  // The three ways a caller can get the command line wrong. Each has to leave the
  // page alone, because a deploy that half-ran is worse than one that did not run.
  it.each([
    ['a network id flag with no value', (d: string) => ['--dist', d, '--network-id']],
    ['a dist flag with no value', (d: string) => ['--network-id', 'preview', '--dist', d, '--dist']],
    ['an unknown flag', (d: string) => ['--network-id', 'preview', '--dist', d, '--config', 'x.json']],
  ])('rejects %s and leaves the page untouched', (_label, args) => {
    const laid = dist();
    const r = spawnSync(SCRIPT, args(laid.dist), { encoding: 'utf-8' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/error: (unknown option|option .* argument missing)/);
    expect(readFileSync(laid.indexPath, 'utf-8')).toContain('@@APP_CONFIG@@');
  });

  // Reads the accepted set out of the CLI and holds the cases above to it.
  it('accepts exactly the networks it reports, and the cases above cover them', () => {
    const laid = dist();
    const r = spawnSync(SCRIPT, ['--network-id', 'nope', '--dist', laid.dist], { encoding: 'utf-8' });
    const reported = r.stderr
      .match(/Known networks: ([a-z ]+)/)?.[1]
      .trim()
      .split(' ');
    expect(reported).toEqual(NETWORK_IDS);
  });
});
