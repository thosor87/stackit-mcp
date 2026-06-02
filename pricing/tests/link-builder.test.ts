import { describe, it, expect } from 'vitest';
import { buildCalculatorServiceList, CALCULATOR_BASE_URL } from '../src/calculator/link-builder.js';
import type { EstimateService } from '../src/types.js';

describe('link-builder', () => {
  it('returns empty list for empty services', () => {
    expect(buildCalculatorServiceList([])).toEqual([]);
  });

  it('returns unique display names', () => {
    const services: EstimateService[] = [
      { service_key: 'server', service_name: 'Server', group: 'Prod', config: {}, monthly_cost_eur: 54 },
      { service_key: 'server', service_name: 'Server', group: 'Dev', config: {}, monthly_cost_eur: 27 },
      { service_key: 'object-storage', service_name: 'Storage', group: 'Prod', config: {}, monthly_cost_eur: 5 },
    ];
    const list = buildCalculatorServiceList(services);
    expect(list).toContain('Server');
    expect(list).toContain('Object Storage');
    expect(list.filter(s => s === 'Server').length).toBe(1);
  });

  it('maps all supported service keys', () => {
    const services: EstimateService[] = [
      { service_key: 'ske', service_name: 'SKE', group: 'Prod', config: {}, monthly_cost_eur: 72 },
      { service_key: 'database-postgres', service_name: 'PG', group: 'Prod', config: {}, monthly_cost_eur: 90 },
      { service_key: 'load-balancer', service_name: 'ALB', group: 'Prod', config: {}, monthly_cost_eur: 18 },
      { service_key: 'public-ip', service_name: 'IP', group: 'Prod', config: {}, monthly_cost_eur: 3 },
    ];
    const list = buildCalculatorServiceList(services);
    expect(list).toContain('STACKIT Kubernetes Engine');
    expect(list).toContain('PostgreSQL Flex');
    expect(list).toContain('Application Load Balancer');
    expect(list).toContain('Public IP Address');
  });

  it('exports the calculator base URL constant', () => {
    expect(CALCULATOR_BASE_URL).toBe('https://calculator.stackit.cloud/');
  });
});
