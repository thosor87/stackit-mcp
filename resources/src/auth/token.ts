import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { ServiceAccountKey, StoredToken, CliCredentials } from './types.js';

const CACHE_DIR = join(homedir(), '.cache', 'stackit-mcp');
const CACHE_FILE = join(CACHE_DIR, 'auth.json');
const TOKEN_ENDPOINT = 'https://service.api.eu01.stackit.cloud/token';
const CLI_CREDENTIALS = join(homedir(), '.config', 'stackit', 'credentials.json');

// In-memory cache
let memToken: StoredToken | null = null;

function loadCliCredentials(): CliCredentials | null {
  try {
    return JSON.parse(readFileSync(CLI_CREDENTIALS, 'utf8'));
  } catch {
    return null;
  }
}

function loadCachedToken(): StoredToken | null {
  if (memToken && memToken.expires_at > Date.now() + 60_000) return memToken;
  try {
    const t = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as StoredToken;
    if (t.expires_at > Date.now() + 60_000) {
      memToken = t;
      return t;
    }
  } catch { /* no cache */ }
  return null;
}

function saveToken(token: StoredToken): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(token));
  memToken = token;
}

// Minimal RS512 JWT sign using Node.js crypto (no external deps)
async function signJwt(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const { createSign } = await import('crypto');
  const header = Buffer.from(JSON.stringify({ alg: 'RS512', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createSign('RSA-SHA512').update(`${header}.${body}`).sign(privateKeyPem, 'base64url');
  return `${header}.${body}.${sig}`;
}

async function exchangeJwt(assertion: string): Promise<StoredToken> {
  const resp = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`STACKIT token exchange failed (${resp.status}): ${body}`);
  }
  const data = await resp.json() as { access_token: string; expires_in?: number };
  return {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

async function getTokenFromSaKey(keyPath: string, privateKeyPath?: string): Promise<StoredToken> {
  const saKey = JSON.parse(readFileSync(keyPath, 'utf8')) as ServiceAccountKey;

  let privateKeyPem: string;
  if (saKey.credentials.privateKey) {
    privateKeyPem = saKey.credentials.privateKey;
  } else if (privateKeyPath) {
    privateKeyPem = readFileSync(privateKeyPath, 'utf8');
  } else {
    throw new Error(
      'Private key not found. Either embed privateKey in the SA key file or set STACKIT_PRIVATE_KEY_PATH.'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt({
    iss: saKey.credentials.iss,
    sub: saKey.credentials.iss,
    aud: 'https://stackit.cloud/',
    iat: now,
    exp: now + 300,
    kid: saKey.credentials.kid,
  }, privateKeyPem);

  return exchangeJwt(assertion);
}

export async function getAccessToken(): Promise<string> {
  // 1. Valid cached token?
  const cached = loadCachedToken();
  if (cached) return cached.access_token;

  // 2. Env var: SA key path
  const envKeyPath = process.env['STACKIT_SERVICE_ACCOUNT_KEY_PATH'];
  if (envKeyPath && existsSync(envKeyPath)) {
    const token = await getTokenFromSaKey(envKeyPath, process.env['STACKIT_PRIVATE_KEY_PATH']);
    saveToken(token);
    return token.access_token;
  }

  // 3. STACKIT CLI credentials file
  const cli = loadCliCredentials();
  if (cli?.STACKIT_SERVICE_ACCOUNT_KEY_PATH && existsSync(cli.STACKIT_SERVICE_ACCOUNT_KEY_PATH)) {
    const token = await getTokenFromSaKey(
      cli.STACKIT_SERVICE_ACCOUNT_KEY_PATH,
      cli.STACKIT_PRIVATE_KEY_PATH
    );
    saveToken(token);
    return token.access_token;
  }

  throw new Error(
    'Not authenticated. Run the auth_login tool or set STACKIT_SERVICE_ACCOUNT_KEY_PATH.'
  );
}

export async function loginWithKeyPath(keyPath: string, privateKeyPath?: string): Promise<void> {
  if (!existsSync(keyPath)) throw new Error(`File not found: ${keyPath}`);
  const token = await getTokenFromSaKey(keyPath, privateKeyPath);
  saveToken(token);
}

export function clearToken(): void {
  memToken = null;
  try { writeFileSync(CACHE_FILE, '{}'); } catch { /* ignore */ }
}
