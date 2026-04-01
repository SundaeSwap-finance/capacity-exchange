/**
 * Wallet seed encryption using WebAuthn PRF (passkey-backed HSM) with
 * fallback to plaintext localStorage for browsers without PRF support.
 *
 * When PRF is available, the encryption key is derived on the hardware
 * security module via HMAC-SHA-256 — it never exists in JavaScript memory
 * except momentarily during encrypt/decrypt. An attacker who dumps
 * localStorage gets only AES-256-GCM ciphertext.
 *
 * When PRF is unavailable, seeds are stored in the clear (demo fallback).
 */

const DB_NAME = 'ces-demo-crypto';
const DB_STORE = 'credentials';
const CREDENTIAL_KEY = 'passkey';
const PRF_SALT = new TextEncoder().encode('capacity-exchange-demo-wallet-v1');

// ── Types ──────────────────────────────────────────────────────────────

export interface EncryptedBlob {
  iv: string;      // base64
  ciphertext: string; // base64
}

export interface PlaintextSecrets {
  seedHex: string;
  mnemonic: string;
}

export type StorageMode = 'passkey' | 'plaintext';

interface StoredCredential {
  credentialId: string; // base64url
  mode: 'passkey';
}

// ── Helpers ────────────────────────────────────────────────────────────

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function toBase64Url(buf: ArrayBuffer): string {
  return toBase64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (b64.length % 4)) % 4;
  return fromBase64(b64 + '='.repeat(pad));
}

// ── IndexedDB for credential metadata ──────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStoredCredential(): Promise<StoredCredential | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(CREDENTIAL_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function saveStoredCredential(cred: StoredCredential): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(cred, CREDENTIAL_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearStoredCredential(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(CREDENTIAL_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── PRF key derivation ─────────────────────────────────────────────────

/**
 * Derives a CryptoKey from the PRF output of a WebAuthn assertion.
 * The 32-byte HMAC-SHA-256 result from the HSM is imported as an
 * AES-256-GCM key. The raw bytes exist in JS memory only during this call.
 */
async function prfOutputToKey(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    prfOutput,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt'],
  );
}

// ── AES-GCM encrypt / decrypt ──────────────────────────────────────────

async function encrypt(key: CryptoKey, plaintext: PlaintextSecrets): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(plaintext));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return { iv: toBase64(iv.buffer), ciphertext: toBase64(ciphertext) };
}

async function decrypt(key: CryptoKey, blob: EncryptedBlob): Promise<PlaintextSecrets> {
  const iv = fromBase64(blob.iv);
  const ciphertext = fromBase64(blob.ciphertext);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

// ── WebAuthn passkey operations ────────────────────────────────────────

type PRFExtension = {
  prf: {
    eval?: { first: BufferSource };
    enabled?: boolean;
    results?: { first: ArrayBuffer };
  };
};

/**
 * Create a passkey and check if the authenticator supports PRF.
 * Returns the credential ID if PRF is enabled, null otherwise.
 */
async function createPasskey(): Promise<{ credentialId: string; prfKey: CryptoKey } | null> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Capacity Exchange Demo' },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'Capacity Exchange Demo',
        displayName: 'Capacity Exchange Demo',
      },
      challenge,
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 },  // RS256
      ],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      extensions: {
        prf: {
          eval: { first: PRF_SALT },
        },
      } as PublicKeyCredentialCreationOptions['extensions'] & PRFExtension,
    },
  }) as PublicKeyCredential | null;

  if (!credential) return null;

  const ext = credential.getClientExtensionResults() as PRFExtension & AuthenticationExtensionsClientOutputs;
  const prfResult = ext.prf;

  // Check if PRF produced a result during creation (trial eval)
  if (prfResult?.results?.first) {
    const credentialId = toBase64Url(credential.rawId);
    const prfKey = await prfOutputToKey(prfResult.results.first);
    return { credentialId, prfKey };
  }

  // PRF was enabled but trial eval wasn't supported — try a get() immediately
  if (prfResult?.enabled) {
    const credentialId = toBase64Url(credential.rawId);
    const prfKey = await authenticateAndDerivePrfKey(credentialId);
    if (prfKey) return { credentialId, prfKey };
  }

  return null;
}

/**
 * Authenticate with an existing passkey and derive the PRF key.
 */
async function authenticateAndDerivePrfKey(credentialId: string): Promise<CryptoKey | null> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{
        type: 'public-key',
        id: fromBase64Url(credentialId),
      }],
      userVerification: 'preferred',
      extensions: {
        prf: {
          eval: { first: PRF_SALT },
        },
      } as PublicKeyCredentialRequestOptions['extensions'] & PRFExtension,
    },
  }) as PublicKeyCredential | null;

  if (!assertion) return null;

  const ext = assertion.getClientExtensionResults() as PRFExtension & AuthenticationExtensionsClientOutputs;
  const prfOutput = ext.prf?.results?.first;
  if (!prfOutput) return null;

  return prfOutputToKey(prfOutput);
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Detect the current storage mode.
 * Returns 'passkey' if a PRF-capable passkey is registered, 'plaintext' otherwise.
 */
export async function detectStorageMode(): Promise<StorageMode> {
  try {
    const stored = await getStoredCredential();
    return stored ? 'passkey' : 'plaintext';
  } catch {
    return 'plaintext';
  }
}

/**
 * Set up passkey-based encryption. Prompts the user to create a passkey.
 * Returns the encryption key and mode, or falls back to plaintext.
 */
export async function setupPasskey(): Promise<{ mode: 'passkey'; encryptFn: EncryptFn; decryptFn: DecryptFn } | null> {
  try {
    const result = await createPasskey();
    if (!result) return null;

    await saveStoredCredential({ credentialId: result.credentialId, mode: 'passkey' });
    const key = result.prfKey;

    return {
      mode: 'passkey',
      encryptFn: (secrets) => encrypt(key, secrets),
      decryptFn: (blob) => decrypt(key, blob),
    };
  } catch (err) {
    console.warn('[CryptoStore] Passkey setup failed:', err);
    return null;
  }
}

/**
 * Unlock an existing passkey. Prompts biometric authentication.
 * Returns encrypt/decrypt functions, or null if the passkey is unavailable.
 */
export async function unlockPasskey(): Promise<{ encryptFn: EncryptFn; decryptFn: DecryptFn } | null> {
  try {
    const stored = await getStoredCredential();
    if (!stored) return null;

    const key = await authenticateAndDerivePrfKey(stored.credentialId);
    if (!key) return null;

    return {
      encryptFn: (secrets) => encrypt(key, secrets),
      decryptFn: (blob) => decrypt(key, blob),
    };
  } catch (err) {
    console.warn('[CryptoStore] Passkey unlock failed:', err);
    return null;
  }
}

export type EncryptFn = (secrets: PlaintextSecrets) => Promise<EncryptedBlob>;
export type DecryptFn = (blob: EncryptedBlob) => Promise<PlaintextSecrets>;
