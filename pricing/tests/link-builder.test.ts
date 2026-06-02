import { describe, it, expect } from 'vitest';
import { buildCalculatorUrl, CALCULATOR_BASE_URL } from '../src/calculator/link-builder.js';
import type { EstimateService } from '../src/types.js';

describe('link-builder', () => {
  it('returns base calculator URL for empty services', () => {
    expect(buildCalculatorUrl([])).toBe(CALCULATOR_BASE_URL);
  });

  it('returns GitHub Pages launcher URL with services', () => {
    const services: EstimateService[] = [
      { service_key: 'server', service_name: 'Server', group: 'Prod', config: {}, monthly_cost_eur: 54 },
      { service_key: 'object-storage', service_name: 'Storage', group: 'Prod', config: {}, monthly_cost_eur: 5 },
    ];
    const url = buildCalculatorUrl(services);
    expect(url).toContain('thosor87.github.io');
    expect(url).toContain('server');
    expect(url).toContain('object-storage');
  });

  it('deduplicates service types', () => {
    const services: EstimateService[] = [
      { service_key: 'server', service_name: 'Server', group: 'Prod', config: {}, monthly_cost_eur: 54 },
      { service_key: 'server', service_name: 'Server', group: 'Dev', config: {}, monthly_cost_eur: 27 },
    ];
    const url = buildCalculatorUrl(services);
    const servicesParam = new URL(url).searchParams.get('services');
    expect(servicesParam?.split(',').filter((s) => s === 'server').length).toBe(1);
  });

  it('maps correct internal IDs for calculator', () => {
    const services: EstimateService[] = [
      { service_key: 'database-postgres', service_name: 'PG', group: 'Prod', config: {}, monthly_cost_eur: 90 },
      { service_key: 'load-balancer', service_name: 'ALB', group: 'Prod', config: {}, monthly_cost_eur: 18 },
    ];
    const url = buildCalculatorUrl(services);
    expect(url).toContain('postgresql-flex');
    expect(url).toContain('application-load-balancer');
  });

  it('includes label and total when provided', () => {
    const services: EstimateService[] = [
      { service_key: 'server', service_name: 'Server', group: 'Prod', config: {}, monthly_cost_eur: 54 },
    ];
    const url = buildCalculatorUrl(services, 'Test Estimate', 54);
    expect(url).toContain('label=Test');
    expect(url).toContain('total=54');
  });
});
