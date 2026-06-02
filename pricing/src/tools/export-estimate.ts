import { getEstimate } from '../estimate/store.js';
import { buildCalculatorUrl } from '../calculator/link-builder.js';
import { loadPrices } from '../pricing/loader.js';
import type { EstimateService } from '../types.js';

interface GroupSummary {
  name: string;
  services: Array<{
    service_key: string;
    service_name: string;
    config: Record<string, unknown>;
    monthly_cost_eur: number;
  }>;
  subtotal_month_eur: number;
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
  const calculator_url = buildCalculatorUrl(estimate.services, estimate.name, total_month_eur);

  return {
    estimate_name: estimate.name,
    groups,
    total_month_eur,
    total_year_eur,
    calculator_url,
    price_source: prices.meta.source,
    price_date: prices.meta.date,
  };
}
