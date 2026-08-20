/** Cryptographically secure randomness, without a Node builtin.
 *
 *  globalThis.crypto is the Web Crypto API, present in browsers, workers, bun, and Node 19+.
 *  The previous `import * as crypto from 'crypto'` typechecked only because @types/node
 *  supplies an ambient declaration, while real resolution failed in any browser bundle,
 *  since neither Webpack 5 nor Vite polyfills Node builtins. */
export function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

/** Random bytes as lowercase hex, for identifiers. */
export function randomHex(length: number): string {
  return Array.from(randomBytes(length))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
