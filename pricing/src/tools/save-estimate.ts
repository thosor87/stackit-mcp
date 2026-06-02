import { writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { getEstimate } from '../estimate/store.js';
import { loadPrices } from '../pricing/loader.js';
import { handleExportEstimate } from './export-estimate.js';

interface SaveEstimateInput {
  estimate_id: string;
  directory?: string;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_');
}

export async function handleSaveEstimate(input: SaveEstimateInput) {
  const estimate = getEstimate(input.estimate_id);
  if (!estimate) throw new Error(`Estimate ${input.estimate_id} not found`);

  const dir = resolve(input.directory ?? join(homedir(), 'Downloads'));
  mkdirSync(dir, { recursive: true });

  const base = sanitize(estimate.name) || 'estimate';
  const result = await handleExportEstimate({ estimate_id: input.estimate_id });

  const mdPath = join(dir, `${base}.md`);
  const csvPath = join(dir, `${base}.csv`);

  writeFileSync(mdPath, result.markdown, 'utf8');
  writeFileSync(csvPath, result.csv, 'utf8');

  return {
    saved: [mdPath, csvPath],
    total_month_eur: result.total_month_eur,
    total_year_eur: result.total_year_eur,
  };
}
