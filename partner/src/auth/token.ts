import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createServer } from 'http';
import { createHash, randomBytes } from 'crypto';

const CACHE_DIR  = join(homedir(), '.cache', 'stackit-mcp');
const CACHE_FILE = join(CACHE_DIR, 'partner-auth.json');

const OIDC_DISCOVERY = 'https://accounts.stackit.cloud/.well-known/openid-configuration';
const CLIENT_ID      = 'stackit-partner-portal-prod';
const SCOPES         = 'email openid';
const CALLBACK_PORTS = [8010, 8011, 8012, 8013];

interface StoredToken {
  access_token: string;
  expires_at: number;
}

let memToken: StoredToken | null = null;

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

async function getOidcEndpoints(): Promise<{ authorizationEndpoint: string; tokenEndpoint: string }> {
  const resp = await fetch(OIDC_DISCOVERY);
  if (!resp.ok) throw new Error('Failed to fetch OIDC discovery');
  const cfg = await resp.json() as { authorization_endpoint?: string; token_endpoint?: string };
  if (!cfg.authorization_endpoint || !cfg.token_endpoint) {
    throw new Error('OIDC discovery response missing required endpoints');
  }
  return { authorizationEndpoint: cfg.authorization_endpoint, tokenEndpoint: cfg.token_endpoint };
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    let i = 0;
    const tryPort = () => {
      if (i >= CALLBACK_PORTS.length) return reject(new Error('No free port in range 8010-8013'));
      const port = CALLBACK_PORTS[i++];
      const srv = createServer();
      srv.once('error', tryPort);
      srv.once('listening', () => { srv.close(); resolve(port); });
      srv.listen(port, '127.0.0.1');
    };
    tryPort();
  });
}

export async function loginInteractive(): Promise<string> {
  const { authorizationEndpoint, tokenEndpoint } = await getOidcEndpoints();
  const port        = await findFreePort();
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

  const server = createServer(async (req, res) => {
    const reqUrl = new URL(req.url!, `http://localhost:${port}`);
    if (reqUrl.pathname !== '/' && reqUrl.pathname !== '') { res.end(); return; }

    const code     = reqUrl.searchParams.get('code');
    const gotState = reqUrl.searchParams.get('state');
    if (!code || gotState !== state) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<html><body style="font-family:sans-serif;padding:2rem"><h2>Login failed</h2><p>Invalid callback. Please try again.</p></body></html>');
      server.close();
      process.stderr.write('[stackit-partner] OAuth callback: invalid state\n');
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
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body style="font-family:sans-serif;padding:2rem"><h2>Login failed</h2><p>Token exchange failed. Please try again.</p></body></html>');
        server.close();
        process.stderr.write(`[stackit-partner] Token exchange failed: ${await tokenResp.text()}\n`);
        return;
      }
      const data = await tokenResp.json() as { access_token: string; expires_in?: number };
      saveToken({
        access_token: data.access_token,
        expires_at:   Date.now() + (data.expires_in ?? 3600) * 1000,
      });
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body style="font-family:sans-serif;padding:2rem"><h2>✓ STACKIT Partner Portal login successful</h2><p>You can close this tab.</p></body></html>');
      server.close();
      process.stderr.write('[stackit-partner] ✓ Token saved\n');
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<html><body>Internal error</body></html>');
      server.close();
      process.stderr.write(`[stackit-partner] Token error: ${e}\n`);
    }
  });

  const timeout = setTimeout(() => server.close(), 300_000);
  server.on('close', () => clearTimeout(timeout));
  server.listen(port, '127.0.0.1');

  return url;
}

export async function getAccessToken(): Promise<string> {
  const cached = loadCachedToken();
  if (cached) return cached.access_token;
  throw new Error(
    'Not authenticated. Use the auth_login tool to log in to the STACKIT Partner Portal.'
  );
}

export function clearToken(): void {
  memToken = null;
  try { writeFileSync(CACHE_FILE, '{}'); } catch { /* ignore */ }
}
