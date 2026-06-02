import { getEstimate } from '../estimate/store.js';
import { loadPrices } from '../pricing/loader.js';
import type { EstimateService } from '../types.js';

export interface GroupSummary {
  name: string;
  services: Array<{
    service_key: string;
    service_name: string;
    config: Record<string, unknown>;
    monthly_cost_eur: number;
  }>;
  subtotal_month_eur: number;
}

function fmt(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function configLabel(config: Record<string, unknown>): string {
  const parts: string[] = [];
  if (config['flavor']) parts.push(String(config['flavor']));
  if (config['quantity'] && Number(config['quantity']) > 1) parts.push(`×${config['quantity']}`);
  if (config['storage_gb']) parts.push(`${config['storage_gb']} GB`);
  if (config['plan']) parts.push(String(config['plan']).replace(/-EU01$/, ''));
  if (config['clusters']) parts.push(`${config['clusters']} Cluster`);
  return parts.join(', ');
}

function buildCsv(name: string, groups: GroupSummary[], total_month: number, total_year: number, source: string, date: string): string {
  const rows: string[] = [
    `"${name}"`,
    '',
    'Stage,Service,Config,EUR/Monat',
  ];
  for (const group of groups) {
    for (const svc of group.services) {
      const cfg = configLabel(svc.config).replace(/"/g, '""');
      rows.push(`"${group.name}","${svc.service_name}","${cfg}","${svc.monthly_cost_eur.toFixed(2).replace('.', ',')}"`);
    }
    rows.push(`"${group.name} – Subtotal","","","${group.subtotal_month_eur.toFixed(2).replace('.', ',')}"`);
    rows.push('');
  }
  rows.push(`"Gesamt / Monat","","","${total_month.toFixed(2).replace('.', ',')}"`);
  rows.push(`"Gesamt / Jahr","","","${total_year.toFixed(2).replace('.', ',')}"`);
  rows.push('');
  rows.push(`"Preisquelle: STACKIT PIM API (${source}), ${date}"`);
  return rows.join('\n');
}

function buildMarkdown(name: string, groups: GroupSummary[], total_month: number, total_year: number, source: string, date: string): string {
  const lines: string[] = [];
  const width = 52;
  const bar = '─'.repeat(width);

  lines.push(`# ${name}`);
  lines.push('');
  lines.push('```');
  lines.push(bar);

  for (const group of groups) {
    lines.push(`  ${group.name}`);
    for (const svc of group.services) {
      const label = `    ${svc.service_name}${configLabel(svc.config) ? ' · ' + configLabel(svc.config) : ''}`;
      const price = `€ ${fmt(svc.monthly_cost_eur)}`;
      const pad = width - label.length - price.length;
      lines.push(label + ' '.repeat(Math.max(1, pad)) + price);
    }
    const sub = `  Subtotal ${group.name}`;
    const subPrice = `€ ${fmt(group.subtotal_month_eur)}`;
    const subPad = width - sub.length - subPrice.length;
    lines.push(sub + ' '.repeat(Math.max(1, subPad)) + subPrice);
    lines.push('');
  }

  lines.push(bar);
  const totalLabel = '  Gesamt / Monat';
  const totalPrice = `€ ${fmt(total_month)}`;
  lines.push(totalLabel + ' '.repeat(Math.max(1, width - totalLabel.length - totalPrice.length)) + totalPrice);

  const yearLabel = '  Gesamt / Jahr';
  const yearPrice = `€ ${fmt(total_year)}`;
  lines.push(yearLabel + ' '.repeat(Math.max(1, width - yearLabel.length - yearPrice.length)) + yearPrice);
  lines.push(bar);
  lines.push('');
  lines.push(`  Preisquelle: STACKIT PIM API (${source}), ${date}`);
  lines.push(`  Alle Preise Nettolistenpreise zzgl. MwSt.`);
  lines.push('```');

  return lines.join('\n');
}

export async function handleExportEstimate(input: { estimate_id: string }) {
  const estimate = getEstimate(input.estimate_id);
  if (!estimate) throw new Error(`Estimate ${input.estimate_id} not found`);

  const prices = await loadPrices();

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

  const markdown = buildMarkdown(
    estimate.name, groups, total_month_eur, total_year_eur,
    prices.meta.source, prices.meta.date
  );
  const csv = buildCsv(
    estimate.name, groups, total_month_eur, total_year_eur,
    prices.meta.source, prices.meta.date
  );

  return {
    estimate_name: estimate.name,
    groups,
    total_month_eur,
    total_year_eur,
    price_source: prices.meta.source,
    price_date: prices.meta.date,
    markdown,
    csv,
  };
}
