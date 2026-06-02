import { writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { getEstimate } from '../estimate/store.js';
import { handleExportEstimate } from './export-estimate.js';
import { buildExcel } from './excel-builder.js';

interface SaveEstimateInput {
  estimate_id: string;
  directory?: string;
  formats?: string[]; // 'xlsx' | 'csv' | 'md' — default: ['xlsx']
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
  const formats = input.formats?.length ? input.formats : ['xlsx'];
  const result = await handleExportEstimate({ estimate_id: input.estimate_id });

  const saved: string[] = [];

  if (formats.includes('xlsx')) {
    const buf = await buildExcel(
      estimate.name,
      result.groups,
      result.total_month_eur,
      result.total_year_eur,
      result.price_source,
      result.price_date
    );
    const path = join(dir, `${base}.xlsx`);
    writeFileSync(path, Buffer.from(buf as ArrayBuffer));
    saved.push(path);
  }

  if (formats.includes('csv')) {
    const path = join(dir, `${base}.csv`);
    writeFileSync(path, result.csv, 'utf8');
    saved.push(path);
  }

  if (formats.includes('md')) {
    const path = join(dir, `${base}.md`);
    writeFileSync(path, result.markdown, 'utf8');
    saved.push(path);
  }

  return {
    saved,
    total_month_eur: result.total_month_eur,
    total_year_eur: result.total_year_eur,
  };
}
