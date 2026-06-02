import { describe, it, expect } from 'vitest';
import { buildCalculatorUrl } from '../src/calculator/link-builder.js';
import type { EstimateService } from '../src/types.js';

describe('link-builder', () => {
  it('returns base URL for empty services', () => {
    expect(buildCalculatorUrl([])).toBe('https://calculator.stackit.cloud/');
  });

  it('adds addService param for each unique calculator_type', () => {
    const services: EstimateService[] = [
      { service_key: 'server', service_name: 'Server', group: 'Prod', config: {}, monthly_cost_eur: 54 },
      { service_key: 'server', service_name: 'Server', group: 'Dev', config: {}, monthly_cost_eur: 27 },
      { service_key: 'object-storage', service_name: 'Storage', group: 'Prod', config: {}, monthly_cost_eur: 5 },
    ];
    const url = buildCalculatorUrl(services);
    expect(url).toContain('addService=server');
    expect(url).toContain('addService=object-storage');
    // server appears only once despite two entries
    expect(url.split('addService=server').length - 1).toBe(1);
  });

  it('is a valid URL', () => {
    const services: EstimateService[] = [
      { service_key: 'ske', service_name: 'SKE', group: 'Prod', config: {}, monthly_cost_eur: 72 },
    ];
    expect(() => new URL(buildCalculatorUrl(services))).not.toThrow();
  });
});
