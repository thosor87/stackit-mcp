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
