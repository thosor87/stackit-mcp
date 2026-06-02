import { loadPrices } from '../pricing/loader.js';
import { buildRegistry, getServiceDefinition } from '../pricing/registry.js';
import { getEstimate, addServiceToEstimate } from '../estimate/store.js';
import type { ServiceDefinition } from '../types.js';

interface AddServiceInput {
  estimate_id: string;
  service_key: string;
  group?: string;
  config: Record<string, unknown>;
}

function calcMonthlyPrice(def: ServiceDefinition, config: Record<string, unknown>): number {
  let total = 0;
  const quantity = Number(config['quantity'] ?? 1);

  for (const field of def.fields) {
    if (field.type === 'dropdown' && field.options) {
      const selectedId = config[field.id] as string;
      const option = field.options.find(o => o.id === selectedId);
      if (option) total += option.price_month;
    } else if (field.type === 'number' && field.price_per_gb_month !== undefined) {
      const gb = Number(config[field.id] ?? field.default ?? 0);
      total += gb * field.price_per_gb_month;
    } else if (field.type === 'number' && field.price_month !== undefined) {
      // For quantity fields on dropdown services, skip — handled by the multiplier below.
      // For standalone price_month fields (ALB, Public IP, Block Storage etc.), apply directly.
      if (field.id === 'quantity' && def.fields.some(f => f.type === 'dropdown')) continue;
      const count = Number(config[field.id] ?? field.default ?? 1);
      total += field.price_month * count;
    }
  }

  // Apply quantity multiplier for dropdown-based services (server flavor, database plan)
  const hasDropdown = def.fields.some(f => f.type === 'dropdown');
  if (hasDropdown && quantity > 1) {
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
