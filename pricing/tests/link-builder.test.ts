import { describe, it, expect } from 'vitest';
import { buildCalculatorUrl } from '../src/calculator/link-builder.js';
import type { EstimateService } from '../src/types.js';

describe('link-builder', () => {
  it('returns base URL for empty services', () => {
    expect(buildCalculatorUrl([])).toBe('https://calculator.stackit.cloud/');
  });

  it('adds addService param for each unique service type', () => {
    const services: EstimateService[] = [
      { service_key: 'server', service_name: 'Server', group: 'Prod', config: {}, monthly_cost_eur: 54 },
      { service_key: 'server', service_name: 'Server', group: 'Dev', config: {}, monthly_cost_eur: 27 },
      { service_key: 'object-storage', service_name: 'Storage', group: 'Prod', config: {}, monthly_cost_eur: 5 },
    ];
    const url = buildCalculatorUrl(services);
    expect(url).toContain('addService=servers');
    expect(url).toContain('addService=object-storage');
    expect(url.split('addService=servers').length - 1).toBe(1);
  });

  it('uses correct apiIdentifiers from STACKIT categories API', () => {
    const services: EstimateService[] = [
      { service_key: 'ske', service_name: 'SKE', group: 'Prod', config: {}, monthly_cost_eur: 72 },
      { service_key: 'database-postgres', service_name: 'PG', group: 'Prod', config: {}, monthly_cost_eur: 90 },
      { service_key: 'load-balancer', service_name: 'ALB', group: 'Prod', config: {}, monthly_cost_eur: 18 },
      { service_key: 'public-ip', service_name: 'IP', group: 'Prod', config: {}, monthly_cost_eur: 3 },
    ];
    const url = buildCalculatorUrl(services);
    expect(url).toContain('addService=ske');
    expect(url).toContain('addService=postgresql-flex');
    expect(url).toContain('addService=alb');
    expect(url).toContain('addService=public-ip-address');
  });

  it('is a valid URL', () => {
    const services: EstimateService[] = [
      { service_key: 'server', service_name: 'Server', group: 'Prod', config: {}, monthly_cost_eur: 54 },
    ];
    expect(() => new URL(buildCalculatorUrl(services))).not.toThrow();
  });
});
