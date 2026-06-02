import type { EstimateService } from '../types.js';

// Maps service_key to the human-readable service name used in calculator.stackit.cloud.
// apiIdentifier values sourced from https://pim.api.stackit.cloud/v1/categories
const CALCULATOR_TYPE: Record<string, string> = {
  'server': 'Servers',
  'object-storage': 'Object Storage',
  'ske': 'STACKIT Kubernetes Engine',
  'database-postgres': 'PostgreSQL Flex',
  'database-mariadb': 'MariaDB',
  'database-redis': 'Redis',
  'load-balancer': 'Application Load Balancer',
  'public-ip': 'Public IP Address',
  'block-storage': 'Block Storage',
};

// Returns unique service display names for the services in an estimate.
// The ?addService= URL approach triggers a race condition in the STACKIT calculator SPA,
// so we provide the base URL + a service list for manual configuration.
export function buildCalculatorServiceList(services: EstimateService[]): string[] {
  return [...new Set(
    services
      .map(s => CALCULATOR_TYPE[s.service_key])
      .filter((t): t is string => t !== undefined)
  )];
}
