# @stackit-mcp/partner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `@stackit-mcp/partner` MCP package that gives Claude access to the STACKIT Partner Portal Customer Relations via `cost.api.stackit.cloud`.

**Architecture:** New `partner/` directory in the mono-repo, following the same structure as `resources/`. Uses PKCE browser login with OAuth client `stackit-partner-portal-prod` (different from the resources/CLI client). Org ID is read from `STACKIT_PARTNER_ORG_ID` env var.

**Tech Stack:** TypeScript, Node.js ≥18, `@modelcontextprotocol/sdk`, `zod`, `vitest` (tests)

---

## File Map

| File | Create/Modify | Responsibility |
|---|---|---|
| `partner/package.json` | Create | Package metadata, deps, build scripts |
| `partner/tsconfig.json` | Create | TypeScript config (identical to resources/) |
| `partner/vitest.config.ts` | Create | Test runner config |
| `partner/src/auth/token.ts` | Create | PKCE login, token cache, `getAccessToken()` |
| `partner/src/api/client.ts` | Create | `partnerGet()` — authenticated HTTP client |
| `partner/src/tools/customers.ts` | Create | `listCustomers()` business logic |
| `partner/src/index.ts` | Create | MCP server, tool registration |
| `partner/tests/customers.test.ts` | Create | Unit tests for customers tool |
| `partner/tests/client.test.ts` | Create | Unit tests for API client |
| `README.md` | Modify | Add partner package to the packages table |

---

## Task 1: Package scaffolding

**Files:**
- Create: `partner/package.json`
- Create: `partner/tsconfig.json`
- Create: `partner/vitest.config.ts`

- [ ] **Step 1: Create `partner/package.json`**

```json
{
  "name": "@stackit-mcp/partner",
  "version": "0.1.0",
  "description": "MCP server for the STACKIT Partner Portal (Customer Relations).",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "stackit-partner": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "files": ["dist"],
  "author": "Thomas Soring",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^4.4.1"
  },
  "devDependencies": {
    "@types/node": "^25.9.3",
    "tsx": "^4.21.0",
    "typescript": "^6.0.3",
    "vitest": "^4.1.8"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Create `partner/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `partner/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
  },
});
```

- [ ] **Step 4: Create directory structure and install dependencies**

```bash
mkdir -p partner/src/auth partner/src/api partner/src/tools partner/tests
cd partner && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add partner/package.json partner/tsconfig.json partner/vitest.config.ts
git commit -m "feat(partner): scaffold @stackit-mcp/partner package"
```

---

## Task 2: Auth module

**Files:**
- Create: `partner/src/auth/token.ts`
- Create: `partner/tests/auth.test.ts`

Key differences vs `resources/src/auth/token.ts`:
- `CLIENT_ID = 'stackit-partner-portal-prod'`
- `SCOPES = 'email openid'` (no `offline_access`)
- Cache file: `~/.cache/stackit-mcp/partner-auth.json`
- No SA key support, no CLI credential fallback, no refresh token logic

- [ ] **Step 1: Write failing test**

Create `partner/tests/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the exported helpers indirectly by mocking the fs module.
// The main contract: getAccessToken() throws when no valid token is cached.

describe('getAccessToken', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('throws when no token is cached', async () => {
    vi.doMock('fs', () => ({
      readFileSync: () => { throw new Error('ENOENT'); },
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      existsSync: () => false,
    }));
    const { getAccessToken } = await import('../src/auth/token.js');
    await expect(getAccessToken()).rejects.toThrow('Not authenticated');
  });

  it('returns access_token from valid cached token', async () => {
    const futureExpiry = Date.now() + 3_600_000;
    vi.doMock('fs', () => ({
      readFileSync: () => JSON.stringify({ access_token: 'tok123', expires_at: futureExpiry }),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      existsSync: () => true,
    }));
    const { getAccessToken } = await import('../src/auth/token.js');
    expect(await getAccessToken()).toBe('tok123');
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd partner && npm test -- tests/auth.test.ts
```

Expected: FAIL — `Cannot find module '../src/auth/token.js'`

- [ ] **Step 3: Implement `partner/src/auth/token.ts`**

```typescript
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
const CALLBACK_PORTS = [8010, 8011, 8012, 8013];  // different range from resources

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
  const cfg = await resp.json() as { authorization_endpoint: string; token_endpoint: string };
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

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body style="font-family:sans-serif;padding:2rem"><h2>✓ STACKIT Partner Portal login successful</h2><p>You can close this tab.</p></body></html>');
    server.close();

    const code     = reqUrl.searchParams.get('code');
    const gotState = reqUrl.searchParams.get('state');
    if (!code || gotState !== state) {
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
        process.stderr.write(`[stackit-partner] Token exchange failed: ${await tokenResp.text()}\n`);
        return;
      }
      const data = await tokenResp.json() as { access_token: string; expires_in?: number };
      saveToken({
        access_token: data.access_token,
        expires_at:   Date.now() + (data.expires_in ?? 3600) * 1000,
      });
      process.stderr.write('[stackit-partner] ✓ Token saved\n');
    } catch (e) {
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd partner && npm test -- tests/auth.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add partner/src/auth/token.ts partner/tests/auth.test.ts
git commit -m "feat(partner): add PKCE auth module for stackit-partner-portal-prod"
```

---

## Task 3: API client

**Files:**
- Create: `partner/src/api/client.ts`
- Create: `partner/tests/client.test.ts`

- [ ] **Step 1: Write failing test**

Create `partner/tests/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('partnerGet', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls the correct URL with Authorization header', async () => {
    vi.doMock('../src/auth/token.js', () => ({
      getAccessToken: async () => 'test-token-xyz',
    }));

    const mockResponse = { customers: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const { partnerGet } = await import('../src/api/client.js');
    const result = await partnerGet('/v3/costs/org123/customers?from=2026-05-01&to=2026-05-31&granularity=monthly');

    expect(fetch).toHaveBeenCalledWith(
      'https://cost.api.stackit.cloud/v3/costs/org123/customers?from=2026-05-01&to=2026-05-31&granularity=monthly',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-xyz',
        }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws on non-OK response with status and body', async () => {
    vi.doMock('../src/auth/token.js', () => ({
      getAccessToken: async () => 'tok',
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as unknown as Response);

    const { partnerGet } = await import('../src/api/client.js');
    await expect(partnerGet('/v3/costs/org/customers')).rejects.toThrow('403');
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd partner && npm test -- tests/client.test.ts
```

Expected: FAIL — `Cannot find module '../src/api/client.js'`

- [ ] **Step 3: Implement `partner/src/api/client.ts`**

```typescript
import { getAccessToken } from '../auth/token.js';

const BASE_URL = 'https://cost.api.stackit.cloud';

export async function partnerGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const url = `${BASE_URL}${path}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Partner API ${resp.status} — ${url}\n${body}`);
  }
  return resp.json() as Promise<T>;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd partner && npm test -- tests/client.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add partner/src/api/client.ts partner/tests/client.test.ts
git commit -m "feat(partner): add HTTP client for cost.api.stackit.cloud"
```

---

## Task 4: Customers tool

**Files:**
- Create: `partner/src/tools/customers.ts`
- Create: `partner/tests/customers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `partner/tests/customers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('listCustomers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('passes from/to/granularity to the API', async () => {
    const mockData = {
      customers: [
        { organizationId: 'id-1', organizationName: 'Acme GmbH', type: 'Reseller', totalCost: 1200.50 },
      ],
    };
    vi.doMock('../src/api/client.js', () => ({
      partnerGet: vi.fn().mockResolvedValue(mockData),
    }));

    const { listCustomers } = await import('../src/tools/customers.js');
    const result = await listCustomers('org-uuid', { from: '2026-05-01', to: '2026-05-31', granularity: 'monthly' });

    const { partnerGet } = await import('../src/api/client.js');
    expect(partnerGet).toHaveBeenCalledWith(
      '/v3/costs/org-uuid/customers?from=2026-05-01&to=2026-05-31&granularity=monthly'
    );
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0]).toMatchObject({
      id: 'id-1',
      name: 'Acme GmbH',
      type: 'Reseller',
      total_cost_eur: 1200.50,
    });
  });

  it('uses previous-month defaults when no dates provided', async () => {
    vi.doMock('../src/api/client.js', () => ({
      partnerGet: vi.fn().mockResolvedValue({ customers: [] }),
    }));

    const { listCustomers } = await import('../src/tools/customers.js');
    await listCustomers('org-uuid', {});

    const { partnerGet } = await import('../src/api/client.js');
    const calledUrl = (partnerGet as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // Defaults: from = first day of previous month, to = last day of previous month
    expect(calledUrl).toMatch(/from=\d{4}-\d{2}-01/);
    expect(calledUrl).toMatch(/to=\d{4}-\d{2}-\d{2}/);
    expect(calledUrl).toContain('granularity=monthly');
  });

  it('returns empty array when API returns no customers field', async () => {
    vi.doMock('../src/api/client.js', () => ({
      partnerGet: vi.fn().mockResolvedValue({}),
    }));

    const { listCustomers } = await import('../src/tools/customers.js');
    const result = await listCustomers('org-uuid', {});
    expect(result.customers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd partner && npm test -- tests/customers.test.ts
```

Expected: FAIL — `Cannot find module '../src/tools/customers.js'`

- [ ] **Step 3: Implement `partner/src/tools/customers.ts`**

```typescript
import { partnerGet } from '../api/client.js';

interface ApiCustomer {
  organizationId?: string;
  id?: string;
  organizationName?: string;
  name?: string;
  type?: string;
  totalCost?: number;
  cost?: number;
}

interface ApiCustomersResponse {
  customers?: ApiCustomer[];
  items?: ApiCustomer[];
}

function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrevMonth  = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(firstOfPrevMonth), to: fmt(lastOfPrevMonth) };
}

export async function listCustomers(
  orgId: string,
  opts: { from?: string; to?: string; granularity?: 'daily' | 'monthly' }
) {
  const defaults = previousMonthRange();
  const params = new URLSearchParams({
    from:        opts.from        ?? defaults.from,
    to:          opts.to          ?? defaults.to,
    granularity: opts.granularity ?? 'monthly',
  });

  const data = await partnerGet<ApiCustomersResponse>(
    `/v3/costs/${orgId}/customers?${params}`
  );

  const raw = data.customers ?? data.items ?? [];
  return {
    customers: raw.map(c => ({
      id:            c.organizationId ?? c.id ?? '',
      name:          c.organizationName ?? c.name ?? '',
      type:          c.type ?? '',
      total_cost_eur: c.totalCost ?? c.cost ?? null,
    })),
  };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd partner && npm test -- tests/customers.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add partner/src/tools/customers.ts partner/tests/customers.test.ts
git commit -m "feat(partner): add listCustomers tool"
```

---

## Task 5: MCP server entry point

**Files:**
- Create: `partner/src/index.ts`

- [ ] **Step 1: Implement `partner/src/index.ts`**

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loginInteractive, clearToken } from './auth/token.js';
import { listCustomers } from './tools/customers.js';

const server = new McpServer({ name: 'stackit-partner', version: '0.1.0' });

function getOrgId(): string {
  const id = process.env['STACKIT_PARTNER_ORG_ID'];
  if (!id) throw new Error(
    'STACKIT_PARTNER_ORG_ID is not set. Add it to your MCP env config.'
  );
  return id;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

server.tool(
  'auth_login',
  'Log in to the STACKIT Partner Portal. Opens a browser window for authentication.',
  {},
  async () => {
    const url = await loginInteractive();
    const { exec } = await import('child_process');
    const openCmd = process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(openCmd, () => { /* ignore errors */ });
    return {
      content: [{
        type: 'text',
        text: `Opening STACKIT Partner Portal login in your browser...\n\nIf the browser didn't open, copy this URL:\n${url}\n\nAfter logging in, call list_customers — the token will be ready.`,
      }],
    };
  }
);

server.tool(
  'auth_logout',
  'Clear the cached STACKIT Partner Portal authentication token.',
  {},
  async () => {
    clearToken();
    return { content: [{ type: 'text', text: 'Partner Portal token cleared.' }] };
  }
);

// ── Customer Relations ────────────────────────────────────────────────────────

server.tool(
  'list_customers',
  'List all customer organizations in the STACKIT Partner Portal with optional cost data for a date range.',
  {
    from: z.string().optional().describe('Start date YYYY-MM-DD (default: first day of previous month)'),
    to:   z.string().optional().describe('End date YYYY-MM-DD (default: last day of previous month)'),
    granularity: z.enum(['daily', 'monthly']).optional().describe('Cost granularity (default: monthly)'),
  },
  async ({ from, to, granularity }) => {
    const result = await listCustomers(getOrgId(), { from, to, granularity });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[stackit-partner] Server running on stdio');
}

main().catch(e => {
  console.error('[stackit-partner] Fatal:', e);
  process.exit(1);
});
```

- [ ] **Step 2: Build and verify no TypeScript errors**

```bash
cd partner && npm run build
```

Expected: `dist/` created, zero TS errors.

- [ ] **Step 3: Smoke-test — server starts**

```bash
cd partner && echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js
```

Expected: JSON response listing `auth_login`, `auth_logout`, `list_customers`.

- [ ] **Step 4: Run full test suite**

```bash
cd partner && npm test
```

Expected: All tests pass (7 tests across 3 files).

- [ ] **Step 5: Commit**

```bash
git add partner/src/index.ts
git commit -m "feat(partner): add MCP server entry point with 3 tools"
```

---

## Task 6: Register in Claude Code & update README

**Files:**
- Modify: `~/.claude.json` (MCP config)
- Modify: `README.md`

- [ ] **Step 1: Add to `~/.claude.json`**

Open `~/.claude.json` and add under the `mcpServers` key (alongside existing STACKIT servers):

```json
"stackit-partner": {
  "command": "node",
  "args": ["/Users/thsoring/Library/CloudStorage/OneDrive-BTCAG/CCode/stackit-mcp/partner/dist/index.js"],
  "env": {
    "STACKIT_PARTNER_ORG_ID": "4e7c251f-0af8-4bc7-ac50-babe4fb8446e"
  }
}
```

Note: The org ID `4e7c251f-0af8-4bc7-ac50-babe4fb8446e` is BTC's partner org ID, visible in the Partner Portal URL. It's not a secret (it's in the URL), but keep it in the MCP config, not in the repo.

- [ ] **Step 2: Reload Claude Code MCP servers**

In Claude Code, run `/mcp` to verify `stackit-partner` appears in the server list.

- [ ] **Step 3: Test end-to-end**

In Claude Code, ask: `"Ruf auth_login auf und logge mich im STACKIT Partner Portal ein."` → browser should open.

After login, ask: `"Liste alle Kunden aus dem STACKIT Partner Portal."` → should return customer list.

- [ ] **Step 4: Update `README.md`**

Add `partner/` to the packages table (after `resources/`):

```markdown
| [partner/](partner/) | Customer Relations from the STACKIT Partner Portal | — (local only) |
```

And add to the Repository structure section:

```
└── partner/                    @stackit-mcp/partner
    ├── src/
    │   ├── auth/               PKCE login (stackit-partner-portal-prod client)
    │   ├── api/                HTTP client for cost.api.stackit.cloud
    │   └── tools/              list_customers
    └── package.json
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add @stackit-mcp/partner to README"
```
