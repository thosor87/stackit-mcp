import type { EstimateService } from '../types.js';

// Maps service_key to the apiIdentifier used in calculator.stackit.cloud ?addService= param.
// Values sourced from https://pim.api.stackit.cloud/v1/categories (product.apiIdentifier)
const CALCULATOR_TYPE: Record<string, string> = {
  'server': 'servers',
  'object-storage': 'object-storage',
  'ske': 'ske',
  'database-postgres': 'postgresql-flex',
  'database-mariadb': 'mariadb',
  'database-redis': 'redis',
  'load-balancer': 'alb',
  'public-ip': 'public-ip-address',
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
