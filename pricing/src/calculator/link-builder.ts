import type { EstimateService } from '../types.js';

// Human-readable names for the services in an estimate.
const SERVICE_DISPLAY_NAME: Record<string, string> = {
  'server': 'Server',
  'object-storage': 'Object Storage',
  'block-storage': 'Block Storage',
  'ske': 'STACKIT Kubernetes Engine',
  'database-postgres': 'PostgreSQL Flex',
  'database-mariadb': 'MariaDB',
  'database-redis': 'Redis',
  'load-balancer': 'Application Load Balancer',
  'public-ip': 'Public IP Address',
};

export const CALCULATOR_BASE_URL = 'https://calculator.stackit.cloud/';

// Returns the unique service display names used in an estimate.
// Note: calculator.stackit.cloud has no external deep-link API — the ?addService=
// parameter is an in-app Angular router feature and fails on fresh page loads due
// to a race condition in their service registry loading. Use the base URL.
export function buildCalculatorServiceList(services: EstimateService[]): string[] {
  return [...new Set(
    services
      .map(s => SERVICE_DISPLAY_NAME[s.service_key])
      .filter((t): t is string => t !== undefined)
  )];
}
