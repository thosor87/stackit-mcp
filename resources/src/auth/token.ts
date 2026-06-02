import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createServer } from 'http';
import { createHash, randomBytes } from 'crypto';
import type { ServiceAccountKey, StoredToken } from './types.js';

const CACHE_DIR  = join(homedir(), '.cache', 'stackit-mcp');
const CACHE_FILE = join(CACHE_DIR, 'auth.json');
const TOKEN_ENDPOINT = 'https://service.api.eu01.stackit.cloud/token';

// STACKIT CLI OAuth2 constants (same client as `stackit auth login`)
const OIDC_DISCOVERY = 'https://accounts.stackit.cloud/.well-known/openid-configuration';
const CLIENT_ID      = 'stackit-cli-0000-0000-000000000001';
const SCOPES         = 'openid offline_access email';
const CALLBACK_PORTS = [8000, 8001, 8002, 8003, 8004, 8005];

// STACKIT CLI credential files (fallback when keychain not accessible)
const CLI_CREDENTIALS_FILE = join(homedir(), '.config', 'stackit', 'credentials.json');
const CLI_AUTH_STORAGE     = join(homedir(), '.config', 'stackit', 'cli-auth-storage.txt');

let memToken: StoredToken | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function loadCachedToken(): StoredToken | null {
  if (memToken && memToken.expires_at > Date.now() + 60_000) return memToken;
  try {
    const t = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as StoredToken;
    if (t.expires_at > Date.now() + 60_000) { memToken = t; return t; }
  } catch { /* no cache */ }
  return null;
}

function saveToken(token: StoredToken): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(token), { mode: 0o600 });
  memToken = token;
}

// ── STACKIT CLI credential fallback ──────────────────────────────────────────

function loadCliAuthStorage(): StoredToken | null {
  try {
    // File fallback: base64-encoded JSON
    const raw = readFileSync(CLI_AUTH_STORAGE, 'utf8').trim();
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const data = JSON.parse(decoded) as {
      access_token?: string;
      refresh_token?: string;
      session_expires_at_unix?: number;
      idp_token_endpoint?: string;
    };
    if (data.access_token && data.session_expires_at_unix) {
      return {
        access_token: data.access_token,
        expires_at: data.session_expires_at_unix * 1000,
        refresh_token: data.refresh_token,
        idp_token_endpoint: data.idp_token_endpoint,
      };
    }
  } catch { /* no cli storage */ }
  return null;
}

async function refreshTokenIfNeeded(token: StoredToken): Promise<StoredToken | null> {
  if (!token.refresh_token) return null;
  const endpoint = token.idp_token_endpoint ?? TOKEN_ENDPOINT;
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
        client_id: CLIENT_ID,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { access_token: string; expires_in?: number; refresh_token?: string };
    const refreshed: StoredToken = {
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
      refresh_token: data.refresh_token ?? token.refresh_token,
      idp_token_endpoint: endpoint,
    };
    saveToken(refreshed);
    return refreshed;
  } catch { return null; }
}

// ── SA key flow (service account) ─────────────────────────────────────────────

async function signJwt(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const { createSign } = await import('crypto');
  const header = Buffer.from(JSON.stringify({ alg: 'RS512', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig    = createSign('RSA-SHA512').update(`${header}.${body}`).sign(privateKeyPem, 'base64url');
  return `${header}.${body}.${sig}`;
}

async function getTokenFromSaKey(keyPath: string, privateKeyPath?: string): Promise<StoredToken> {
  const saKey = JSON.parse(readFileSync(keyPath, 'utf8')) as ServiceAccountKey;
  let privateKeyPem: string;
  if (saKey.credentials.privateKey) {
    privateKeyPem = saKey.credentials.privateKey;
  } else if (privateKeyPath) {
    privateKeyPem = readFileSync(privateKeyPath, 'utf8');
  } else {
    throw new Error('Private key not found. Embed it in the SA key file or set STACKIT_PRIVATE_KEY_PATH.');
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt({
    iss: saKey.credentials.iss, sub: saKey.credentials.iss,
    aud: 'https://stackit.cloud/', iat: now, exp: now + 300,
    kid: saKey.credentials.kid,
  }, privateKeyPem);
  const resp = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!resp.ok) throw new Error(`STACKIT token exchange failed (${resp.status}): ${await resp.text()}`);
  const data = await resp.json() as { access_token: string; expires_in?: number };
  return { access_token: data.access_token, expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 };
}

// ── PKCE interactive flow (same as `stackit auth login`) ─────────────────────

async function getOidcEndpoints(): Promise<{ authorizationEndpoint: string; tokenEndpoint: string }> {
  const resp = await fetch(OIDC_DISCOVERY);
  if (!resp.ok) throw new Error('Failed to fetch OIDC discovery');
  const cfg = await resp.json() as { authorization_endpoint: string; token_endpoint: string };
  return { authorizationEndpoint: cfg.authorization_endpoint, tokenEndpoint: cfg.token_endpoint };
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    let i = 0;
    const tryPort = () => {
      if (i >= CALLBACK_PORTS.length) return reject(new Error('No free port in range 8000-8005'));
      const port = CALLBACK_PORTS[i++];
      const srv = createServer();
      srv.once('error', tryPort);
      srv.once('listening', () => { srv.close(); resolve(port); });
      srv.listen(port, '127.0.0.1');
    };
    tryPort();
  });
}

// Starts the OAuth server in the background and returns the URL immediately.
// The server saves the token when the callback arrives and then shuts down.
export async function loginInteractive(): Promise<string> {
  const { authorizationEndpoint, tokenEndpoint } = await getOidcEndpoints();
  const port        = await findFreePort();
  // STACKIT OAuth server registers "http://localhost:{port}" (no path) — RFC 8252 loopback
  const redirectUri = `http://localhost:${port}`;
  const verifier    = b64url(randomBytes(32));
  const challenge   = b64url(createHash('sha256').update(verifier).digest());
  const state       = b64url(randomBytes(16));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  redirectUri,
    scope:         SCOPES,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    state,
  });
  const url = `${authorizationEndpoint}?${params}`;

  // Start server in background — resolves/rejects silently
  const server = createServer(async (req, res) => {
    const reqUrl = new URL(req.url!, `http://localhost:${port}`);
    // STACKIT redirects to root path or with query params at root
    if (reqUrl.pathname !== '/' && reqUrl.pathname !== '') { res.end(); return; }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body style="font-family:sans-serif;padding:2rem"><h2>✓ STACKIT login successful</h2><p>You can close this tab.</p></body></html>');
    server.close();

    const code     = reqUrl.searchParams.get('code');
    const gotState = reqUrl.searchParams.get('state');
    if (!code || gotState !== state) {
      process.stderr.write('[stackit-resources] OAuth callback: invalid state\n');
      return;
    }
    try {
      const tokenResp = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'authorization_code',
          client_id:     CLIENT_ID,
          code,
          redirect_uri:  redirectUri,
          code_verifier: verifier,
        }),
      });
      if (!tokenResp.ok) {
        process.stderr.write(`[stackit-resources] Token exchange failed: ${await tokenResp.text()}\n`);
        return;
      }
      const data = await tokenResp.json() as {
        access_token: string; expires_in?: number; refresh_token?: string;
      };
      saveToken({
        access_token:  data.access_token,
        expires_at:    Date.now() + (data.expires_in ?? 3600) * 1000,
        refresh_token: data.refresh_token,
        idp_token_endpoint: tokenEndpoint,
      });
      process.stderr.write('[stackit-resources] ✓ Token saved\n');
    } catch (e) {
      process.stderr.write(`[stackit-resources] Token error: ${e}\n`);
    }
  });

  // Auto-close server after 5 minutes if no callback
  const timeout = setTimeout(() => server.close(), 300_000);
  server.on('close', () => clearTimeout(timeout));
  server.listen(port, '127.0.0.1');

  return url;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function getAccessToken(): Promise<string> {
  // 1. Memory / disk cache
  const cached = loadCachedToken();
  if (cached) return cached.access_token;

  // 2. STACKIT CLI auth storage (browser login via `stackit auth login`)
  const cliToken = loadCliAuthStorage();
  if (cliToken) {
    if (cliToken.expires_at > Date.now() + 60_000) {
      saveToken(cliToken);
      return cliToken.access_token;
    }
    const refreshed = await refreshTokenIfNeeded(cliToken);
    if (refreshed) return refreshed.access_token;
  }

  // 3. Env var: SA key path
  const envKeyPath = process.env['STACKIT_SERVICE_ACCOUNT_KEY_PATH'];
  if (envKeyPath && existsSync(envKeyPath)) {
    const token = await getTokenFromSaKey(envKeyPath, process.env['STACKIT_PRIVATE_KEY_PATH']);
    saveToken(token);
    return token.access_token;
  }

  // 4. STACKIT CLI credentials.json (SA key path)
  if (existsSync(CLI_CREDENTIALS_FILE)) {
    const cli = JSON.parse(readFileSync(CLI_CREDENTIALS_FILE, 'utf8')) as {
      STACKIT_SERVICE_ACCOUNT_KEY_PATH?: string;
      STACKIT_PRIVATE_KEY_PATH?: string;
    };
    if (cli.STACKIT_SERVICE_ACCOUNT_KEY_PATH && existsSync(cli.STACKIT_SERVICE_ACCOUNT_KEY_PATH)) {
      const token = await getTokenFromSaKey(cli.STACKIT_SERVICE_ACCOUNT_KEY_PATH, cli.STACKIT_PRIVATE_KEY_PATH);
      saveToken(token);
      return token.access_token;
    }
  }

  throw new Error(
    'Not authenticated. Use the auth_login tool to log in with your STACKIT account.'
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
