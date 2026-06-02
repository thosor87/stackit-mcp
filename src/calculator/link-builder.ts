import type { EstimateService } from '../types.js';

// Maps service_key to the type used in calculator.stackit.cloud ?addService= param.
const CALCULATOR_TYPE: Record<string, string> = {
  'server': 'server',
  'object-storage': 'object-storage',
  'ske': 'kubernetes-engine',
  'database-postgres': 'postgresql',
  'database-mariadb': 'mariadb',
  'database-redis': 'redis',
  'load-balancer': 'load-balancer',
  'public-ip': 'public-ip',
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
