import { describe, it, expect } from 'vitest';
import { buildCalculatorServiceList } from '../src/calculator/link-builder.js';
import type { EstimateService } from '../src/types.js';

describe('link-builder', () => {
  it('returns empty array for empty services', () => {
    expect(buildCalculatorServiceList([])).toEqual([]);
  });

  it('returns unique service display names', () => {
    const services: EstimateService[] = [
      { service_key: 'server', service_name: 'Server', group: 'Prod', config: {}, monthly_cost_eur: 54 },
      { service_key: 'server', service_name: 'Server', group: 'Dev', config: {}, monthly_cost_eur: 27 },
      { service_key: 'object-storage', service_name: 'Storage', group: 'Prod', config: {}, monthly_cost_eur: 5 },
    ];
    const list = buildCalculatorServiceList(services);
    expect(list).toContain('Servers');
    expect(list).toContain('Object Storage');
    expect(list.filter(s => s === 'Servers').length).toBe(1);
  });

  it('maps all supported service keys', () => {
    const services: EstimateService[] = [
      { service_key: 'ske', service_name: 'SKE', group: 'Prod', config: {}, monthly_cost_eur: 72 },
      { service_key: 'database-postgres', service_name: 'PostgreSQL', group: 'Prod', config: {}, monthly_cost_eur: 40 },
    ];
    const list = buildCalculatorServiceList(services);
    expect(list).toContain('STACKIT Kubernetes Engine');
    expect(list).toContain('PostgreSQL Flex');
  });
});
