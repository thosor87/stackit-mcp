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
