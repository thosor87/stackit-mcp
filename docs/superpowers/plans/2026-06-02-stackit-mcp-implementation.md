# STACKIT MCP Pricing Calculator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional MCP server that lets Claude create STACKIT cost estimates using the live PIM API and export them with a calculator.stackit.cloud link.

**Architecture:** TypeScript + stdio transport. Pricing data from public STACKIT PIM API (`https://pim.api.stackit.cloud/v1/skus?region=eu01`) with local cache (24h TTL) and bundled JSON fallback. Five MCP tools mirroring the AWS pricing calculator pattern.

**Tech Stack:** TypeScript 5, `@modelcontextprotocol/sdk`, `zod`, `vitest`, Node.js 18+, no external scraping dependencies.

**Key API discovery:** The STACKIT calculator uses a public PIM API — no HTML scraping needed. The calculator URL supports `?addService=<type>` deep links but not full configuration encoding (no AWS-style full deep links).

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/index.ts` | stdio MCP entry point, registers all 5 tools |
| `src/types.ts` | All shared TypeScript interfaces |
| `src/pricing/api.ts` | Fetch SKUs from `pim.api.stackit.cloud` |
| `src/pricing/loader.ts` | Cache → Live API → Bundle fallback logic |
| `src/pricing/prices.json` | Bundled fallback prices (pre-populated from API) |
| `src/estimate/store.ts` | In-memory Map of estimates |
| `src/calculator/link-builder.ts` | Build `calculator.stackit.cloud` URLs |
| `src/tools/search-services.ts` | `search_services` tool handler |
| `src/tools/get-service-fields.ts` | `get_service_fields` tool handler |
| `src/tools/create-estimate.ts` | `create_estimate` tool handler |
| `src/tools/add-service.ts` | `add_service` tool handler + price calculation |
| `src/tools/export-estimate.ts` | `export_estimate` tool handler |
| `scripts/update-prices.ts` | CLI: fetch API → write prices.json |
| `tests/loader.test.ts` | Unit tests for loader fallback logic |
| `tests/store.test.ts` | Unit tests for estimate store |
| `tests/tools.test.ts` | Unit tests for all 5 tools |
| `tests/e2e.test.ts` | End-to-end: create → add → export |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.npmignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "stackit-mcp",
  "version": "0.1.0",
  "description": "MCP server for STACKIT cloud pricing estimates.",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "stackit-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "update-prices": "tsx scripts/update-prices.ts"
  },
  "files": ["dist", "src/pricing/prices.json"],
  "author": "Thomas Soring",
  "license": "ISC",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^4.4.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.21.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

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
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "scripts"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.js.map
~/.cache/stackit-mcp/
```

- [ ] **Step 5: Create .npmignore**

```
src/
tests/
scripts/
docs/
tsconfig.json
vitest.config.ts
*.test.ts
```

- [ ] **Step 6: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Create directory structure**

```bash
mkdir -p src/pricing src/estimate src/calculator src/tools tests scripts
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: project scaffolding — package.json, tsconfig, vitest"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { PriceData, Estimate, EstimateService } from '../src/types.js';

describe('types', () => {
  it('PriceData has required shape', () => {
    const data: PriceData = {
      meta: { source: 'bundle', date: '2026-06-02', lastUpdatedAt: '2026-06-02T00:00:00Z' },
      skus: [],
    };
    expect(data.meta.source).toBe('bundle');
    expect(Array.isArray(data.skus)).toBe(true);
  });

  it('Estimate has required shape', () => {
    const est: Estimate = {
      id: 'abc',
      name: 'Test',
      services: [],
      createdAt: new Date().toISOString(),
    };
    expect(est.services).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/types.test.ts
```

Expected: FAIL — `Cannot find module '../src/types.js'`

- [ ] **Step 3: Create src/types.ts**

```typescript
// Raw SKU from pim.api.stackit.cloud/v1/skus
export interface StackitSku {
  id: string;
  sku: string;
  title: string;
  name: string;
  region: string;
  category: string;
  product: string;
  unit: string;
  unitBilling: string;
  price: string;           // price per unit (e.g. per hour)
  monthlyPrice: string;    // pre-calculated monthly price
  currency: string;
  maturityModelState: string;
  deprecated: string;
  attributes: Record<string, unknown>;
  generalProductGroup: string | null;
}

export interface PimApiResponse {
  lastUpdatedAt: string;
  services: StackitSku[];
}

export type PriceSource = 'live' | 'cache' | 'bundle';

export interface PriceMeta {
  source: PriceSource;
  date: string;
  lastUpdatedAt: string;
}

export interface PriceData {
  meta: PriceMeta;
  skus: StackitSku[];
}

export interface ServiceResult {
  service_key: string;
  name: string;
  category: string;
  description: string;
}

export interface FieldOption {
  id: string;
  label: string;
  price_month: number;
  attributes?: Record<string, unknown>;
}

export interface ServiceField {
  id: string;
  type: 'dropdown' | 'number';
  label: string;
  options?: FieldOption[];
  price_per_gb_month?: number;
  price_month?: number;
  default?: number;
  unit?: string;
  required?: boolean;
}

export interface ServiceDefinition {
  service_key: string;
  name: string;
  category: string;
  description: string;
  calculator_type: string;   // used in calculator.stackit.cloud URL
  fields: ServiceField[];
}

export interface EstimateService {
  service_key: string;
  service_name: string;
  group: string;
  config: Record<string, unknown>;
  monthly_cost_eur: number;
}

export interface Estimate {
  id: string;
  name: string;
  services: EstimateService[];
  createdAt: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Estimate Store

**Files:**
- Create: `src/estimate/store.ts`
- Create: `tests/store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createEstimate, getEstimate, addServiceToEstimate, resetStore } from '../src/estimate/store.js';

describe('estimate store', () => {
  beforeEach(() => resetStore());

  it('creates estimate with unique ID', () => {
    const a = createEstimate('Test A');
    const b = createEstimate('Test B');
    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe('Test A');
    expect(a.services).toHaveLength(0);
  });

  it('returns undefined for unknown ID', () => {
    expect(getEstimate('nonexistent')).toBeUndefined();
  });

  it('retrieves created estimate', () => {
    const est = createEstimate('My Estimate');
    expect(getEstimate(est.id)).toStrictEqual(est);
  });

  it('adds service to estimate', () => {
    const est = createEstimate('Test');
    const service = {
      service_key: 'server',
      service_name: 'STACKIT Server',
      group: 'Production',
      config: { flavor: 'g1.2', quantity: 2 },
      monthly_cost_eur: 109.18,
    };
    addServiceToEstimate(est.id, service);
    expect(getEstimate(est.id)!.services).toHaveLength(1);
    expect(getEstimate(est.id)!.services[0].monthly_cost_eur).toBe(109.18);
  });

  it('throws for unknown estimate ID in addService', () => {
    expect(() => addServiceToEstimate('bad-id', {
      service_key: 'server', service_name: 'x', group: 'x', config: {}, monthly_cost_eur: 0,
    })).toThrow('Estimate bad-id not found');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/store.test.ts
```

Expected: FAIL — `Cannot find module '../src/estimate/store.js'`

- [ ] **Step 3: Create src/estimate/store.ts**

```typescript
import { randomUUID } from 'node:crypto';
import type { Estimate, EstimateService } from '../types.js';

const estimates = new Map<string, Estimate>();

export function createEstimate(name: string = 'My Estimate'): Estimate {
  const estimate: Estimate = {
    id: randomUUID(),
    name,
    services: [],
    createdAt: new Date().toISOString(),
  };
  estimates.set(estimate.id, estimate);
  return estimate;
}

export function getEstimate(id: string): Estimate | undefined {
  return estimates.get(id);
}

export function addServiceToEstimate(id: string, service: EstimateService): Estimate {
  const estimate = estimates.get(id);
  if (!estimate) throw new Error(`Estimate ${id} not found`);
  estimate.services.push(service);
  return estimate;
}

export function resetStore(): void {
  estimates.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/store.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/estimate/store.ts tests/store.test.ts
git commit -m "feat: add in-memory estimate store"
```

---

## Task 4: Link Builder

**Files:**
- Create: `src/calculator/link-builder.ts`
- Create: `tests/link-builder.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/link-builder.test.ts
import { describe, it, expect } from 'vitest';
import { buildCalculatorUrl } from '../src/calculator/link-builder.js';
import type { EstimateService } from '../src/types.js';

describe('link-builder', () => {
  it('returns base URL for empty services', () => {
    expect(buildCalculatorUrl([])).toBe('https://calculator.stackit.cloud/');
  });

  it('adds addService param for each unique calculator_type', () => {
    const services: EstimateService[] = [
      { service_key: 'server', service_name: 'Server', group: 'Prod', config: {}, monthly_cost_eur: 54 },
      { service_key: 'server', service_name: 'Server', group: 'Dev', config: {}, monthly_cost_eur: 27 },
      { service_key: 'object-storage', service_name: 'Storage', group: 'Prod', config: {}, monthly_cost_eur: 5 },
    ];
    const url = buildCalculatorUrl(services);
    expect(url).toContain('addService=server');
    expect(url).toContain('addService=object-storage');
    // server appears only once despite two entries
    expect(url.split('addService=server').length - 1).toBe(1);
  });

  it('is a valid URL', () => {
    const services: EstimateService[] = [
      { service_key: 'ske', service_name: 'SKE', group: 'Prod', config: {}, monthly_cost_eur: 72 },
    ];
    expect(() => new URL(buildCalculatorUrl(services))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/link-builder.test.ts
```

Expected: FAIL — `Cannot find module '../src/calculator/link-builder.js'`

- [ ] **Step 3: Create src/calculator/link-builder.ts**

```typescript
import type { EstimateService } from '../types.js';

// Maps service_key to the type used in calculator.stackit.cloud ?addService= param.
// The calculator opens a pre-selected service dialog when this param is present.
const CALCULATOR_TYPE: Record<string, string> = {
  'server': 'server',
  'object-storage': 'object-storage',
  'ske': 'kubernetes-engine',
  'database-postgres': 'postgresql',
  'database-mariadb': 'mariadb',
  'load-balancer': 'load-balancer',
  'public-ip': 'public-ip',
  'block-storage': 'block-storage',
};

const BASE_URL = 'https://calculator.stackit.cloud/';

export function buildCalculatorUrl(services: EstimateService[]): string {
  const types = [...new Set(
    services
      .map(s => CALCULATOR_TYPE[s.service_key])
      .filter((t): t is string => t !== undefined)
  )];

  if (types.length === 0) return BASE_URL;

  const params = types.map(t => `addService=${encodeURIComponent(t)}`).join('&');
  return `${BASE_URL}?${params}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/link-builder.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/calculator/link-builder.ts tests/link-builder.test.ts
git commit -m "feat: add calculator.stackit.cloud link builder"
```

---

## Task 5: PIM API Client + Bundled prices.json

**Files:**
- Create: `src/pricing/api.ts`
- Create: `src/pricing/prices.json`
- Create: `scripts/update-prices.ts`

- [ ] **Step 1: Create src/pricing/api.ts**

```typescript
import type { PimApiResponse, PriceData } from '../types.js';

const PIM_API_URL = 'https://pim.api.stackit.cloud/v1/skus';
const DEFAULT_REGION = 'eu01';

export async function fetchSkus(region: string = DEFAULT_REGION): Promise<PriceData> {
  const url = `${PIM_API_URL}?region=${encodeURIComponent(region)}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'stackit-mcp/0.1.0' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`STACKIT PIM API error: ${response.status} ${response.statusText}`);
  }

  const raw: PimApiResponse = await response.json() as PimApiResponse;

  return {
    meta: {
      source: 'live',
      date: new Date().toISOString().split('T')[0],
      lastUpdatedAt: raw.lastUpdatedAt,
    },
    skus: raw.services,
  };
}
```

- [ ] **Step 2: Create scripts/update-prices.ts**

```typescript
#!/usr/bin/env tsx
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchSkus } from '../src/pricing/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '../src/pricing/prices.json');

async function main() {
  console.log('Fetching STACKIT SKUs from PIM API...');
  const data = await fetchSkus('eu01');
  data.meta.source = 'bundle';
  await writeFile(OUTPUT, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✓ Written ${data.skus.length} SKUs to src/pricing/prices.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run update-prices to generate the bundled JSON**

```bash
npm run update-prices
```

Expected output:
```
Fetching STACKIT SKUs from PIM API...
✓ Written 723 SKUs to src/pricing/prices.json
```

Verify the file exists and has content:
```bash
wc -l src/pricing/prices.json
# should be > 1000 lines
```

- [ ] **Step 4: Commit**

```bash
git add src/pricing/api.ts src/pricing/prices.json scripts/update-prices.ts
git commit -m "feat: add STACKIT PIM API client and bundled prices.json (723 SKUs)"
```

---

## Task 6: Price Loader (Cache → API → Bundle)

**Files:**
- Create: `src/pricing/loader.ts`
- Create: `tests/loader.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/loader.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetPriceCache } from '../src/pricing/loader.js';

// We test the fallback logic by mocking api.ts and fs
vi.mock('../src/pricing/api.js', () => ({
  fetchSkus: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

import { fetchSkus } from '../src/pricing/api.js';
import { stat, readFile } from 'node:fs/promises';

describe('price loader', () => {
  beforeEach(async () => {
    resetPriceCache();
    vi.clearAllMocks();
  });

  it('falls back to bundle when API throws', async () => {
    vi.mocked(stat).mockRejectedValue(new Error('no cache'));
    vi.mocked(fetchSkus).mockRejectedValue(new Error('network error'));

    const { loadPrices } = await import('../src/pricing/loader.js');
    const data = await loadPrices();

    expect(data.meta.source).toBe('bundle');
    expect(Array.isArray(data.skus)).toBe(true);
    expect(data.skus.length).toBeGreaterThan(0);
  });

  it('uses live data when API succeeds', async () => {
    vi.mocked(stat).mockRejectedValue(new Error('no cache'));
    vi.mocked(fetchSkus).mockResolvedValue({
      meta: { source: 'live', date: '2026-06-02', lastUpdatedAt: '2026-06-02T00:00:00Z' },
      skus: [{ id: 'test', sku: 'ST-0001', title: 'Test', name: 'Test', region: 'eu01',
        category: 'Compute Engine', product: 'Server', unit: 'Hours', unitBilling: 'per hour',
        price: '0.038', monthlyPrice: '27.30', currency: '€', maturityModelState: 'ga',
        deprecated: 'No', attributes: { flavor: 'g1.1', vCPU: 1, ram: 4 },
        generalProductGroup: 'Server' }],
    });

    const { loadPrices } = await import('../src/pricing/loader.js');
    const data = await loadPrices();

    expect(data.meta.source).toBe('live');
    expect(data.skus).toHaveLength(1);
  });

  it('caches the result in memory after first load', async () => {
    vi.mocked(stat).mockRejectedValue(new Error('no cache'));
    vi.mocked(fetchSkus).mockRejectedValue(new Error('network error'));

    const { loadPrices } = await import('../src/pricing/loader.js');
    await loadPrices();
    await loadPrices();

    // fetchSkus called only once — memory cache hit on second call
    expect(vi.mocked(fetchSkus)).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/loader.test.ts
```

Expected: FAIL — `Cannot find module '../src/pricing/loader.js'`

- [ ] **Step 3: Create src/pricing/loader.ts**

```typescript
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import type { PriceData } from '../types.js';
import { fetchSkus } from './api.js';

const CACHE_DIR = join(homedir(), '.cache', 'stackit-mcp');
const CACHE_FILE = join(CACHE_DIR, 'prices.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function isCacheFresh(): Promise<boolean> {
  try {
    const stats = await stat(CACHE_FILE);
    return Date.now() - stats.mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

async function readCache(): Promise<PriceData> {
  const raw = await readFile(CACHE_FILE, 'utf-8');
  const data = JSON.parse(raw) as PriceData;
  return { ...data, meta: { ...data.meta, source: 'cache' } };
}

async function writeCache(data: PriceData): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function loadBundle(): PriceData {
  const require = createRequire(import.meta.url);
  const raw = require('./prices.json') as PriceData;
  return { ...raw, meta: { ...raw.meta, source: 'bundle' } };
}

let _cached: PriceData | null = null;

export async function loadPrices(): Promise<PriceData> {
  if (_cached) return _cached;

  // 1. Disk cache
  if (await isCacheFresh()) {
    try {
      _cached = await readCache();
      return _cached;
    } catch { /* fall through */ }
  }

  // 2. Live API
  try {
    const live = await fetchSkus();
    await writeCache(live).catch(() => { /* non-fatal */ });
    _cached = live;
    return _cached;
  } catch { /* fall through */ }

  // 3. Bundle fallback
  _cached = loadBundle();
  return _cached;
}

export function resetPriceCache(): void {
  _cached = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/loader.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pricing/loader.ts tests/loader.test.ts
git commit -m "feat: add price loader with cache → API → bundle fallback"
```

---

## Task 7: Service Registry

**Files:**
- Create: `src/pricing/registry.ts`
- Create: `tests/registry.test.ts`

The registry maps the flat list of SKUs into structured `ServiceDefinition` objects that the tools can use.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/registry.test.ts
import { describe, it, expect } from 'vitest';
import type { StackitSku } from '../src/types.js';
import { buildRegistry, searchServices, getServiceDefinition } from '../src/pricing/registry.js';

const MOCK_SKUS: StackitSku[] = [
  {
    id: 'STA_1', sku: 'ST-0008501', title: 'General Purpose Server-g1.1-EU01',
    name: 'General Purpose Server-g1.1-EU01', region: 'eu01',
    category: 'Compute Engine', product: 'Server', unit: 'Hours', unitBilling: 'per hour',
    price: '0.03791', monthlyPrice: '27.2961599976', currency: '€',
    maturityModelState: 'ga', deprecated: 'No',
    attributes: { flavor: 'g1.1', vCPU: 1, ram: 4, metro: false },
    generalProductGroup: 'Server',
  },
  {
    id: 'STA_2', sku: 'ST-0007901', title: 'General Purpose Server-g1.2-EU01',
    name: 'General Purpose Server-g1.2-EU01', region: 'eu01',
    category: 'Compute Engine', product: 'Server', unit: 'Hours', unitBilling: 'per hour',
    price: '0.07582', monthlyPrice: '54.5923200024', currency: '€',
    maturityModelState: 'ga', deprecated: 'No',
    attributes: { flavor: 'g1.2', vCPU: 2, ram: 8, metro: false },
    generalProductGroup: 'Server',
  },
  {
    id: 'STA_3', sku: 'ST-OS001', title: 'Object Storage Premium-EU01',
    name: 'Object Storage Premium-EU01', region: 'eu01',
    category: 'Storage', product: 'Object Storage', unit: 'Gigabyte Hours', unitBilling: 'per gb/h',
    price: '0.00003697772', monthlyPrice: '0.0266239584', currency: '€',
    maturityModelState: 'ga', deprecated: 'No',
    attributes: {},
    generalProductGroup: 'Object Storage',
  },
];

describe('service registry', () => {
  it('builds a registry from SKUs', () => {
    const registry = buildRegistry(MOCK_SKUS);
    expect(registry.has('server')).toBe(true);
    expect(registry.has('object-storage')).toBe(true);
  });

  it('search returns matching services', () => {
    const registry = buildRegistry(MOCK_SKUS);
    const results = searchServices(registry, 'server');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].service_key).toBe('server');
  });

  it('search is case-insensitive', () => {
    const registry = buildRegistry(MOCK_SKUS);
    const results = searchServices(registry, 'STORAGE');
    expect(results.some(r => r.service_key === 'object-storage')).toBe(true);
  });

  it('getServiceDefinition returns flavor options for server', () => {
    const registry = buildRegistry(MOCK_SKUS);
    const def = getServiceDefinition(registry, 'server');
    expect(def).not.toBeNull();
    const flavorField = def!.fields.find(f => f.id === 'flavor');
    expect(flavorField?.options).toHaveLength(2);
    expect(flavorField?.options?.[0].id).toBe('g1.1');
    expect(flavorField?.options?.[0].price_month).toBeCloseTo(27.30, 0);
  });

  it('getServiceDefinition returns per-gb price for object-storage', () => {
    const registry = buildRegistry(MOCK_SKUS);
    const def = getServiceDefinition(registry, 'object-storage');
    expect(def).not.toBeNull();
    const storageField = def!.fields.find(f => f.id === 'storage_gb');
    expect(storageField?.price_per_gb_month).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/registry.test.ts
```

Expected: FAIL — `Cannot find module '../src/pricing/registry.js'`

- [ ] **Step 3: Create src/pricing/registry.ts**

```typescript
import type { StackitSku, ServiceDefinition, FieldOption } from '../types.js';

export type ServiceRegistry = Map<string, ServiceDefinition>;

// Maps product names from PIM API to our service keys
const PRODUCT_TO_KEY: Record<string, string> = {
  'Server': 'server',
  'Object Storage': 'object-storage',
  'Kubernetes Engine': 'ske',
  'PostgreSQL Flex': 'database-postgres',
  'MariaDB': 'database-mariadb',
  'Redis': 'database-redis',
  'Application Load Balancer': 'load-balancer',
  'Public IP': 'public-ip',
  'Block Storage': 'block-storage',
};

const SERVICE_META: Record<string, { description: string; calculator_type: string }> = {
  'server': { description: 'General Purpose VM instances (g1.x flavors)', calculator_type: 'server' },
  'object-storage': { description: 'S3-compatible object storage', calculator_type: 'object-storage' },
  'ske': { description: 'Managed Kubernetes Engine clusters', calculator_type: 'kubernetes-engine' },
  'database-postgres': { description: 'Managed PostgreSQL Flex instances', calculator_type: 'postgresql' },
  'database-mariadb': { description: 'Managed MariaDB instances', calculator_type: 'mariadb' },
  'database-redis': { description: 'Managed Redis instances', calculator_type: 'redis' },
  'load-balancer': { description: 'Application Load Balancer', calculator_type: 'load-balancer' },
  'public-ip': { description: 'Public IPv4 addresses', calculator_type: 'public-ip' },
  'block-storage': { description: 'Persistent block storage volumes', calculator_type: 'block-storage' },
};

function parseMonthlyPrice(sku: StackitSku): number {
  return parseFloat(sku.monthlyPrice) || 0;
}

function buildServerDefinition(skus: StackitSku[]): ServiceDefinition {
  // Only non-metro, non-deprecated, flavor-bearing SKUs
  const flavorSkus = skus.filter(s =>
    s.product === 'Server' &&
    s.deprecated === 'No' &&
    s.attributes['metro'] === false &&
    typeof s.attributes['flavor'] === 'string'
  );

  const options: FieldOption[] = flavorSkus.map(s => ({
    id: s.attributes['flavor'] as string,
    label: `${s.attributes['flavor']} (${s.attributes['vCPU']} vCPU, ${s.attributes['ram']} GB RAM)`,
    price_month: parseMonthlyPrice(s),
    attributes: s.attributes,
  })).sort((a, b) => a.price_month - b.price_month);

  return {
    service_key: 'server',
    name: 'STACKIT Server',
    category: 'Compute Engine',
    description: SERVICE_META['server'].description,
    calculator_type: SERVICE_META['server'].calculator_type,
    fields: [
      { id: 'flavor', type: 'dropdown', label: 'Instance Flavor', options, required: true },
      { id: 'quantity', type: 'number', label: 'Quantity', default: 1, required: true },
    ],
  };
}

function buildObjectStorageDefinition(skus: StackitSku[]): ServiceDefinition {
  const sku = skus.find(s => s.product === 'Object Storage' && s.deprecated === 'No' && !s.name.includes('Archiving'));
  // Price is per Gigabyte Hours; monthly = price * 24 * 30
  const pricePerGbMonth = sku ? parseFloat(sku.price) * 24 * 30 : 0;

  return {
    service_key: 'object-storage',
    name: 'Object Storage',
    category: 'Storage',
    description: SERVICE_META['object-storage'].description,
    calculator_type: SERVICE_META['object-storage'].calculator_type,
    fields: [
      { id: 'storage_gb', type: 'number', label: 'Storage (GB)', price_per_gb_month: pricePerGbMonth, default: 100, required: true },
    ],
  };
}

function buildSkeDefinition(skus: StackitSku[]): ServiceDefinition {
  const clusterSku = skus.find(s => s.product === 'Kubernetes Engine' && s.name.includes('Cluster Management') && s.deprecated === 'No');
  const clusterPrice = clusterSku ? parseMonthlyPrice(clusterSku) : 0;

  return {
    service_key: 'ske',
    name: 'STACKIT Kubernetes Engine',
    category: 'Developer Platform',
    description: SERVICE_META['ske'].description,
    calculator_type: SERVICE_META['ske'].calculator_type,
    fields: [
      { id: 'clusters', type: 'number', label: 'Number of Clusters', default: 1, price_month: clusterPrice, required: true },
    ],
  };
}

function buildDatabaseDefinition(serviceKey: string, product: string, skus: StackitSku[]): ServiceDefinition {
  const dbSkus = skus.filter(s => s.product === product && s.deprecated === 'No');
  const options: FieldOption[] = dbSkus.map(s => ({
    id: s.name,
    label: s.name.replace(/-EU01$/, '').replace(`${product}-`, ''),
    price_month: parseMonthlyPrice(s),
  })).sort((a, b) => a.price_month - b.price_month).slice(0, 8);

  const meta = SERVICE_META[serviceKey];
  return {
    service_key: serviceKey,
    name: product,
    category: 'Database',
    description: meta?.description ?? product,
    calculator_type: meta?.calculator_type ?? serviceKey,
    fields: [
      { id: 'plan', type: 'dropdown', label: 'Plan', options, required: true },
      { id: 'quantity', type: 'number', label: 'Instances', default: 1, required: true },
    ],
  };
}

function buildSimpleDefinition(serviceKey: string, product: string, skus: StackitSku[]): ServiceDefinition {
  const sku = skus.find(s => s.product === product && s.deprecated === 'No');
  const price = sku ? parseMonthlyPrice(sku) : 0;
  const meta = SERVICE_META[serviceKey];

  return {
    service_key: serviceKey,
    name: product,
    category: sku?.category ?? 'Other',
    description: meta?.description ?? product,
    calculator_type: meta?.calculator_type ?? serviceKey,
    fields: [
      { id: 'quantity', type: 'number', label: 'Quantity', default: 1, price_month: price, required: true },
    ],
  };
}

export function buildRegistry(skus: StackitSku[]): ServiceRegistry {
  const registry = new Map<string, ServiceDefinition>();
  registry.set('server', buildServerDefinition(skus));
  registry.set('object-storage', buildObjectStorageDefinition(skus));
  registry.set('ske', buildSkeDefinition(skus));
  registry.set('database-postgres', buildDatabaseDefinition('database-postgres', 'PostgreSQL Flex', skus));
  registry.set('database-mariadb', buildDatabaseDefinition('database-mariadb', 'MariaDB', skus));
  registry.set('database-redis', buildDatabaseDefinition('database-redis', 'Redis', skus));
  registry.set('load-balancer', buildSimpleDefinition('load-balancer', 'Application Load Balancer', skus));
  registry.set('public-ip', buildSimpleDefinition('public-ip', 'Public IP', skus));
  registry.set('block-storage', buildSimpleDefinition('block-storage', 'Block Storage', skus));
  return registry;
}

export function searchServices(registry: ServiceRegistry, query: string): ServiceDefinition[] {
  const q = query.toLowerCase();
  return [...registry.values()].filter(s =>
    s.service_key.includes(q) ||
    s.name.toLowerCase().includes(q) ||
    s.category.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q)
  );
}

export function getServiceDefinition(registry: ServiceRegistry, serviceKey: string): ServiceDefinition | null {
  return registry.get(serviceKey) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/registry.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pricing/registry.ts tests/registry.test.ts
git commit -m "feat: add service registry — maps PIM API SKUs to service definitions"
```

---

## Task 8: All 5 Tools + MCP Server

**Files:**
- Create: `src/tools/search-services.ts`
- Create: `src/tools/get-service-fields.ts`
- Create: `src/tools/create-estimate.ts`
- Create: `src/tools/add-service.ts`
- Create: `src/tools/export-estimate.ts`
- Create: `src/index.ts`
- Create: `tests/tools.test.ts`

- [ ] **Step 1: Write failing tools test**

```typescript
// tests/tools.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/pricing/loader.js', () => ({
  loadPrices: vi.fn(),
  resetPriceCache: vi.fn(),
}));

import { loadPrices } from '../src/pricing/loader.js';
import { resetStore } from '../src/estimate/store.js';
import { handleSearchServices } from '../src/tools/search-services.js';
import { handleGetServiceFields } from '../src/tools/get-service-fields.js';
import { handleCreateEstimate } from '../src/tools/create-estimate.js';
import { handleAddService } from '../src/tools/add-service.js';
import { handleExportEstimate } from '../src/tools/export-estimate.js';
import type { PriceData } from '../src/types.js';

const MOCK_PRICE_DATA: PriceData = {
  meta: { source: 'bundle', date: '2026-06-02', lastUpdatedAt: '2026-06-02T00:00:00Z' },
  skus: [
    {
      id: 'STA_1', sku: 'ST-0008501', title: 'General Purpose Server-g1.1-EU01',
      name: 'General Purpose Server-g1.1-EU01', region: 'eu01',
      category: 'Compute Engine', product: 'Server', unit: 'Hours', unitBilling: 'per hour',
      price: '0.03791', monthlyPrice: '27.2961599976', currency: '€',
      maturityModelState: 'ga', deprecated: 'No',
      attributes: { flavor: 'g1.1', vCPU: 1, ram: 4, metro: false },
      generalProductGroup: 'Server',
    },
    {
      id: 'STA_2', sku: 'ST-0007901', title: 'General Purpose Server-g1.2-EU01',
      name: 'General Purpose Server-g1.2-EU01', region: 'eu01',
      category: 'Compute Engine', product: 'Server', unit: 'Hours', unitBilling: 'per hour',
      price: '0.07582', monthlyPrice: '54.5923200024', currency: '€',
      maturityModelState: 'ga', deprecated: 'No',
      attributes: { flavor: 'g1.2', vCPU: 2, ram: 8, metro: false },
      generalProductGroup: 'Server',
    },
    {
      id: 'STA_3', sku: 'ST-OS001', title: 'Object Storage Premium-EU01',
      name: 'Object Storage Premium-EU01', region: 'eu01',
      category: 'Storage', product: 'Object Storage', unit: 'Gigabyte Hours', unitBilling: 'per gb/h',
      price: '0.00003697772', monthlyPrice: '0.0266239584', currency: '€',
      maturityModelState: 'ga', deprecated: 'No',
      attributes: {},
      generalProductGroup: 'Object Storage',
    },
  ],
};

describe('tools', () => {
  beforeEach(() => {
    vi.mocked(loadPrices).mockResolvedValue(MOCK_PRICE_DATA);
    resetStore();
  });

  describe('search_services', () => {
    it('returns matching services for query', async () => {
      const result = await handleSearchServices({ query: 'server' });
      expect(result.services.length).toBeGreaterThan(0);
      expect(result.services[0].service_key).toBe('server');
    });

    it('returns empty array for no match', async () => {
      const result = await handleSearchServices({ query: 'zzznomatch' });
      expect(result.services).toHaveLength(0);
    });
  });

  describe('get_service_fields', () => {
    it('returns fields for server', async () => {
      const result = await handleGetServiceFields({ service_key: 'server' });
      expect(result.service_key).toBe('server');
      expect(result.fields.length).toBeGreaterThan(0);
      const flavorField = result.fields.find((f: { id: string }) => f.id === 'flavor');
      expect(flavorField).toBeDefined();
    });

    it('throws for unknown service key', async () => {
      await expect(handleGetServiceFields({ service_key: 'unknown-xyz' }))
        .rejects.toThrow('Service unknown-xyz not found');
    });
  });

  describe('create_estimate', () => {
    it('creates estimate with default name', async () => {
      const result = await handleCreateEstimate({});
      expect(result.estimate_id).toBeTruthy();
      expect(result.name).toBe('My Estimate');
    });

    it('creates estimate with custom name', async () => {
      const result = await handleCreateEstimate({ name: 'Prod Setup' });
      expect(result.name).toBe('Prod Setup');
    });
  });

  describe('add_service', () => {
    it('adds server to estimate and returns monthly cost', async () => {
      const { estimate_id } = await handleCreateEstimate({});
      const result = await handleAddService({
        estimate_id,
        service_key: 'server',
        group: 'Production',
        config: { flavor: 'g1.2', quantity: 2 },
      });
      expect(result.monthly_cost_eur).toBeCloseTo(109.18, 0);
      expect(result.service_key).toBe('server');
    });

    it('throws for unknown estimate ID', async () => {
      await expect(handleAddService({
        estimate_id: 'bad-id', service_key: 'server', group: 'Dev', config: { flavor: 'g1.1', quantity: 1 },
      })).rejects.toThrow('Estimate bad-id not found');
    });

    it('throws for unknown service key', async () => {
      const { estimate_id } = await handleCreateEstimate({});
      await expect(handleAddService({
        estimate_id, service_key: 'unknown', group: 'Dev', config: {},
      })).rejects.toThrow('Service unknown not found');
    });
  });

  describe('export_estimate', () => {
    it('returns cost breakdown and calculator URL', async () => {
      const { estimate_id } = await handleCreateEstimate({ name: 'Test' });
      await handleAddService({ estimate_id, service_key: 'server', group: 'Prod', config: { flavor: 'g1.1', quantity: 1 } });

      const result = await handleExportEstimate({ estimate_id });
      expect(result.total_month_eur).toBeGreaterThan(0);
      expect(result.total_year_eur).toBeCloseTo(result.total_month_eur * 12, 1);
      expect(result.calculator_url).toContain('calculator.stackit.cloud');
      expect(result.calculator_url).toContain('addService=server');
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].name).toBe('Prod');
    });

    it('throws for unknown estimate', async () => {
      await expect(handleExportEstimate({ estimate_id: 'no-such' }))
        .rejects.toThrow('Estimate no-such not found');
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/tools.test.ts
```

Expected: FAIL — multiple missing module errors

- [ ] **Step 3: Create src/tools/search-services.ts**

```typescript
import { loadPrices } from '../pricing/loader.js';
import { buildRegistry, searchServices } from '../pricing/registry.js';

interface SearchServicesInput {
  query: string;
}

export async function handleSearchServices(input: SearchServicesInput) {
  const prices = await loadPrices();
  const registry = buildRegistry(prices.skus);
  const results = searchServices(registry, input.query);

  return {
    services: results.map(s => ({
      service_key: s.service_key,
      name: s.name,
      category: s.category,
      description: s.description,
    })),
    price_source: prices.meta.source,
    price_date: prices.meta.date,
  };
}
```

- [ ] **Step 4: Create src/tools/get-service-fields.ts**

```typescript
import { loadPrices } from '../pricing/loader.js';
import { buildRegistry, getServiceDefinition } from '../pricing/registry.js';

interface GetServiceFieldsInput {
  service_key: string;
}

export async function handleGetServiceFields(input: GetServiceFieldsInput) {
  const prices = await loadPrices();
  const registry = buildRegistry(prices.skus);
  const def = getServiceDefinition(registry, input.service_key);

  if (!def) throw new Error(`Service ${input.service_key} not found`);

  return {
    service_key: def.service_key,
    name: def.name,
    category: def.category,
    description: def.description,
    fields: def.fields,
    price_source: prices.meta.source,
    price_date: prices.meta.date,
  };
}
```

- [ ] **Step 5: Create src/tools/create-estimate.ts**

```typescript
import { createEstimate } from '../estimate/store.js';

interface CreateEstimateInput {
  name?: string;
}

export async function handleCreateEstimate(input: CreateEstimateInput) {
  const estimate = createEstimate(input.name ?? 'My Estimate');
  return {
    estimate_id: estimate.id,
    name: estimate.name,
  };
}
```

- [ ] **Step 6: Create src/tools/add-service.ts**

```typescript
import { loadPrices } from '../pricing/loader.js';
import { buildRegistry, getServiceDefinition } from '../pricing/registry.js';
import { getEstimate, addServiceToEstimate } from '../estimate/store.js';

interface AddServiceInput {
  estimate_id: string;
  service_key: string;
  group?: string;
  config: Record<string, unknown>;
}

function calcMonthlyPrice(def: ReturnType<typeof getServiceDefinition>, config: Record<string, unknown>): number {
  if (!def) return 0;
  let total = 0;

  for (const field of def.fields) {
    if (field.type === 'dropdown' && field.id === 'flavor') {
      const flavorId = config['flavor'] as string;
      const option = field.options?.find(o => o.id === flavorId);
      if (option) total += option.price_month;
    } else if (field.type === 'number' && field.price_per_gb_month !== undefined) {
      const gb = Number(config[field.id] ?? field.default ?? 0);
      total += gb * field.price_per_gb_month;
    } else if (field.type === 'dropdown' && field.id === 'plan') {
      const planId = config['plan'] as string;
      const option = field.options?.find(o => o.id === planId);
      if (option) total += option.price_month;
    } else if (field.price_month !== undefined) {
      const qty = Number(config[field.id] ?? config['quantity'] ?? field.default ?? 1);
      total += field.price_month * qty;
    }
  }

  const quantity = Number(config['quantity'] ?? 1);
  // For server: multiply by quantity (already handled via flavor price × quantity)
  // For quantity-only fields, already multiplied above.
  // For flavor-based services, multiply total by quantity if quantity field present and flavor field present
  const hasFlavor = def.fields.some(f => f.id === 'flavor');
  if (hasFlavor && quantity > 1) {
    total = total * quantity;
  }

  return Math.round(total * 100) / 100;
}

export async function handleAddService(input: AddServiceInput) {
  const estimate = getEstimate(input.estimate_id);
  if (!estimate) throw new Error(`Estimate ${input.estimate_id} not found`);

  const prices = await loadPrices();
  const registry = buildRegistry(prices.skus);
  const def = getServiceDefinition(registry, input.service_key);
  if (!def) throw new Error(`Service ${input.service_key} not found`);

  const monthly_cost_eur = calcMonthlyPrice(def, input.config);

  addServiceToEstimate(input.estimate_id, {
    service_key: input.service_key,
    service_name: def.name,
    group: input.group ?? 'Default',
    config: input.config,
    monthly_cost_eur,
  });

  return {
    service_key: input.service_key,
    service_name: def.name,
    group: input.group ?? 'Default',
    monthly_cost_eur,
    price_source: prices.meta.source,
    price_date: prices.meta.date,
  };
}
```

- [ ] **Step 7: Create src/tools/export-estimate.ts**

```typescript
import { getEstimate } from '../estimate/store.js';
import { buildCalculatorUrl } from '../calculator/link-builder.js';
import { loadPrices } from '../pricing/loader.js';
import type { EstimateService } from '../types.js';

interface GroupSummary {
  name: string;
  services: Array<{ service_key: string; service_name: string; config: Record<string, unknown>; monthly_cost_eur: number }>;
  subtotal_month_eur: number;
}

export async function handleExportEstimate(input: { estimate_id: string }) {
  const estimate = getEstimate(input.estimate_id);
  if (!estimate) throw new Error(`Estimate ${input.estimate_id} not found`);

  const prices = await loadPrices();

  // Group services
  const groupMap = new Map<string, EstimateService[]>();
  for (const svc of estimate.services) {
    const existing = groupMap.get(svc.group) ?? [];
    existing.push(svc);
    groupMap.set(svc.group, existing);
  }

  const groups: GroupSummary[] = [...groupMap.entries()].map(([name, svcs]) => ({
    name,
    services: svcs.map(s => ({
      service_key: s.service_key,
      service_name: s.service_name,
      config: s.config,
      monthly_cost_eur: s.monthly_cost_eur,
    })),
    subtotal_month_eur: Math.round(svcs.reduce((sum, s) => sum + s.monthly_cost_eur, 0) * 100) / 100,
  }));

  const total_month_eur = Math.round(groups.reduce((sum, g) => sum + g.subtotal_month_eur, 0) * 100) / 100;
  const total_year_eur = Math.round(total_month_eur * 12 * 100) / 100;
  const calculator_url = buildCalculatorUrl(estimate.services);

  return {
    estimate_name: estimate.name,
    groups,
    total_month_eur,
    total_year_eur,
    calculator_url,
    price_source: prices.meta.source,
    price_date: prices.meta.date,
    note: 'calculator.stackit.cloud link pre-selects service types. Configure quantities and flavors in the browser for a full interactive estimate.',
  };
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npm test -- tests/tools.test.ts
```

Expected: PASS (all tool tests)

- [ ] **Step 9: Create src/index.ts**

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleSearchServices } from './tools/search-services.js';
import { handleGetServiceFields } from './tools/get-service-fields.js';
import { handleCreateEstimate } from './tools/create-estimate.js';
import { handleAddService } from './tools/add-service.js';
import { handleExportEstimate } from './tools/export-estimate.js';

const server = new McpServer({
  name: 'stackit-mcp',
  version: '0.1.0',
});

server.tool(
  'search_services',
  'Search available STACKIT services for pricing estimates (e.g. "server", "database", "storage")',
  { query: z.string().describe('Search term') },
  async ({ query }) => {
    const result = await handleSearchServices({ query });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'get_service_fields',
  'Get configurable fields and pricing options for a STACKIT service',
  { service_key: z.string().describe('Service key from search_services, e.g. "server"') },
  async ({ service_key }) => {
    const result = await handleGetServiceFields({ service_key });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'create_estimate',
  'Create a new STACKIT cost estimate',
  { name: z.string().optional().describe('Estimate name (default: "My Estimate")') },
  async ({ name }) => {
    const result = await handleCreateEstimate({ name });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'add_service',
  'Add a STACKIT service to an estimate and get its monthly price',
  {
    estimate_id: z.string().describe('Estimate ID from create_estimate'),
    service_key: z.string().describe('Service key, e.g. "server"'),
    group: z.string().optional().describe('Group label, e.g. "Production", "Dev"'),
    config: z.record(z.unknown()).describe('Service configuration, e.g. {"flavor": "g1.2", "quantity": 2}'),
  },
  async ({ estimate_id, service_key, group, config }) => {
    const result = await handleAddService({ estimate_id, service_key, group, config: config as Record<string, unknown> });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'export_estimate',
  'Export a STACKIT estimate: get full cost breakdown and a calculator.stackit.cloud link',
  { estimate_id: z.string().describe('Estimate ID from create_estimate') },
  async ({ estimate_id }) => {
    const result = await handleExportEstimate({ estimate_id });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[stackit-mcp] Server running on stdio');
}

main().catch(e => {
  console.error('[stackit-mcp] Fatal:', e);
  process.exit(1);
});
```

- [ ] **Step 10: Commit**

```bash
git add src/tools/ src/index.ts tests/tools.test.ts
git commit -m "feat: implement all 5 MCP tools and stdio server entry point"
```

---

## Task 9: E2E Test

**Files:**
- Create: `tests/e2e.test.ts`

- [ ] **Step 1: Write the E2E test**

```typescript
// tests/e2e.test.ts
import { describe, it, expect } from 'vitest';
import { resetStore } from '../src/estimate/store.js';
import { handleCreateEstimate } from '../src/tools/create-estimate.js';
import { handleSearchServices } from '../src/tools/search-services.js';
import { handleGetServiceFields } from '../src/tools/get-service-fields.js';
import { handleAddService } from '../src/tools/add-service.js';
import { handleExportEstimate } from '../src/tools/export-estimate.js';

// This test uses the real bundled prices.json — no mocking
describe('E2E: TYPO3 3-Stage estimate using bundled prices', () => {
  it('creates a 3-stage TYPO3 estimate and exports it', async () => {
    resetStore();

    // 1. Search for server
    const search = await handleSearchServices({ query: 'server' });
    expect(search.services.some(s => s.service_key === 'server')).toBe(true);

    // 2. Get fields
    const fields = await handleGetServiceFields({ service_key: 'server' });
    expect(fields.fields.find((f: { id: string }) => f.id === 'flavor')).toBeDefined();

    // 3. Create estimate
    const { estimate_id } = await handleCreateEstimate({ name: 'TYPO3 Infrastructure' });

    // 4. Add services — Dev
    await handleAddService({ estimate_id, service_key: 'server', group: 'Dev', config: { flavor: 'g1.1', quantity: 1 } });
    await handleAddService({ estimate_id, service_key: 'database-postgres', group: 'Dev', config: { plan: 'PostgreSQL-Flex-4.8-Single-EU01', quantity: 1 } });

    // 5. Add services — Staging
    await handleAddService({ estimate_id, service_key: 'server', group: 'Staging', config: { flavor: 'g1.2', quantity: 1 } });
    await handleAddService({ estimate_id, service_key: 'database-postgres', group: 'Staging', config: { plan: 'PostgreSQL-Flex-4.8-Single-EU01', quantity: 1 } });

    // 6. Add services — Production
    await handleAddService({ estimate_id, service_key: 'server', group: 'Production', config: { flavor: 'g1.2', quantity: 2 } });
    await handleAddService({ estimate_id, service_key: 'database-postgres', group: 'Production', config: { plan: 'PostgreSQL-Flex-8.32-Replica-EU01', quantity: 1 } });
    await handleAddService({ estimate_id, service_key: 'object-storage', group: 'Production', config: { storage_gb: 500 } });

    // 7. Export
    const result = await handleExportEstimate({ estimate_id });

    expect(result.groups).toHaveLength(3);
    expect(result.total_month_eur).toBeGreaterThan(0);
    expect(result.total_year_eur).toBeCloseTo(result.total_month_eur * 12, 0);
    expect(result.calculator_url).toContain('https://calculator.stackit.cloud/');
    expect(result.calculator_url).toContain('addService=server');
    expect(result.price_source).toMatch(/^(live|cache|bundle)$/);

    console.log('\n=== TYPO3 E2E Estimate ===');
    console.log(`Total: €${result.total_month_eur}/month | €${result.total_year_eur}/year`);
    console.log(`URL: ${result.calculator_url}`);
    console.log(`Source: ${result.price_source} (${result.price_date})`);
  }, 30_000); // 30s timeout — may need to fetch live prices
});
```

- [ ] **Step 2: Run E2E test**

```bash
npm test -- tests/e2e.test.ts
```

Expected: PASS — output shows estimate totals and calculator URL

- [ ] **Step 3: Commit**

```bash
git add tests/e2e.test.ts
git commit -m "test: add E2E test covering full create → add → export flow"
```

---

## Task 10: Build + Local Registration

**Files:**
- Modify: `~/.claude.json` (add stackit-mcp server)

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: `dist/` directory created, no TypeScript errors.

- [ ] **Step 2: Smoke test the built binary**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

Expected: JSON response listing 5 tools (`search_services`, `get_service_fields`, `create_estimate`, `add_service`, `export_estimate`).

- [ ] **Step 3: Register in ~/.claude.json**

Open `~/.claude.json` and add to the `mcpServers` object:

```json
"stackit-mcp": {
  "type": "stdio",
  "command": "node",
  "args": ["/Users/thsoring/Library/CloudStorage/OneDrive-BTCAG/CCode/stackit-mcp/dist/index.js"]
}
```

- [ ] **Step 4: Reload Claude Code VSCode window**

Press `Cmd+Shift+P` → "Developer: Reload Window"

Verify `stackit-mcp` appears in the MCP servers panel as Connected.

- [ ] **Step 5: Run all tests to confirm nothing is broken**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add dist/ -f || true
git add .gitignore
git commit -m "build: compiled dist for local development registration"
```

---

## Task 11: npm Publish

- [ ] **Step 1: Check npm login**

```bash
npm whoami
```

Expected: your npm username. If not logged in: `npm login`.

- [ ] **Step 2: Verify package contents**

```bash
npm pack --dry-run
```

Expected output includes: `dist/index.js`, `src/pricing/prices.json`. Does NOT include: `tests/`, `src/*.ts`, `docs/`.

- [ ] **Step 3: Publish**

```bash
npm publish --access public
```

Expected: `+ stackit-mcp@0.1.0`

- [ ] **Step 4: Verify installable via npx**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx -y stackit-mcp@latest
```

Expected: same 5-tool JSON response as Step 2 in Task 10.

- [ ] **Step 5: Switch ~/.claude.json to npx**

Update the `stackit-mcp` entry in `~/.claude.json`:

```json
"stackit-mcp": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "stackit-mcp@latest"]
}
```

- [ ] **Step 6: Reload VSCode and verify still Connected**

`Cmd+Shift+P` → "Developer: Reload Window"

- [ ] **Step 7: Final commit**

```bash
git tag v0.1.0
git push origin main --tags
git commit -m "chore: update README with npm install instructions" --allow-empty
```

---

## Quick Reference

**Run all tests:**
```bash
npm test
```

**Update prices before release:**
```bash
npm run update-prices && npm run build && npm publish
```

**Local dev (uses local dist):**
```json
{ "type": "stdio", "command": "node", "args": ["/Users/thsoring/.../stackit-mcp/dist/index.js"] }
```

**Published (npx):**
```json
{ "type": "stdio", "command": "npx", "args": ["-y", "stackit-mcp@latest"] }
```
