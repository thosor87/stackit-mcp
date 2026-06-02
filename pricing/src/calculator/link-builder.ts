import type { EstimateService } from '../types.js';

// apiIdentifier values verified against https://pim.api.stackit.cloud/v1/categories
const SERVICE_API_ID: Record<string, string> = {
  'server': 'servers',
  'object-storage': 'object-storage',
  'block-storage': 'block-storage',
  'ske': 'ske',
  'database-postgres': 'postgresql-flex',
  'database-mariadb': 'mariadb',
  'database-redis': 'redis',
  'load-balancer': 'alb',
  'public-ip': 'public-ip-address',
};

const BASE_URL = 'https://calculator.stackit.cloud/';

// Builds a calculator deep link. The ?addService= params work via Angular in-app
// navigation (i.e. when the calculator tab is already open). On a fresh page load
// the STACKIT calculator may throw a race-condition error — reloading once fixes it.
export function buildCalculatorUrl(services: EstimateService[]): string {
  const types = [...new Set(
    services
      .map(s => SERVICE_API_ID[s.service_key])
      .filter((t): t is string => t !== undefined)
  )];

  if (types.length === 0) return BASE_URL;

  const params = types.map(t => `addService=${encodeURIComponent(t)}`).join('&');
  return `${BASE_URL}?${params}`;
}
