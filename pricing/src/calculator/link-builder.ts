import type { EstimateService } from '../types.js';

// Internal IDs from calculator.stackit.cloud/assets/data/supported-services.json
// Used as ?addService= values in the GitHub Pages launcher page.
const SERVICE_INTERNAL_ID: Record<string, string> = {
  'server': 'server',
  'object-storage': 'object-storage',
  'block-storage': 'block-storage',
  'ske': 'ske',
  'database-postgres': 'postgresql-flex',
  'database-mariadb': 'mariadb',
  'database-redis': 'redis',
  'load-balancer': 'application-load-balancer',
  'public-ip': 'public-ip-address',
};

const LAUNCHER_BASE = 'https://thosor87.github.io/stackit-mcp/open.html';
export const CALCULATOR_BASE_URL = 'https://calculator.stackit.cloud/';

// Builds a launcher URL on GitHub Pages that:
// 1. Opens calculator.stackit.cloud/ first (no addService, no race condition)
// 2. After 3s, shows per-service buttons — each click does an in-app Angular navigation
//    with ?addService=<id> which works because the registry is already loaded.
export function buildCalculatorUrl(services: EstimateService[], name?: string, totalMonthEur?: number): string {
  const ids = [...new Set(
    services
      .map(s => SERVICE_INTERNAL_ID[s.service_key])
      .filter((t): t is string => t !== undefined)
  )];

  if (ids.length === 0) return CALCULATOR_BASE_URL;

  const params = new URLSearchParams();
  params.set('services', ids.join(','));
  if (name) params.set('label', name);
  if (totalMonthEur !== undefined) params.set('total', totalMonthEur.toFixed(2));

  return `${LAUNCHER_BASE}?${params.toString()}`;
}
