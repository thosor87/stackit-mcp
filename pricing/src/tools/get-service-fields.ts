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
