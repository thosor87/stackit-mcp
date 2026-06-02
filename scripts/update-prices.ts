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
