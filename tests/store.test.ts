import { describe, it, expect, beforeEach } from 'vitest';
import { createEstimate, getEstimate, addServiceToEstimate, resetStore } from '../src/estimate/store.js';

describe('estimate store', () => {
  beforeEach(() => resetStore());

  it('creates estimate with unique ID', () => {
    const a = createEstimate('Test A');
    const b = createEstimate('Test B');
    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe('Test A');
    expect(a.services).toHaveLength(0);
  });

  it('returns undefined for unknown ID', () => {
    expect(getEstimate('nonexistent')).toBeUndefined();
  });

  it('retrieves created estimate', () => {
    const est = createEstimate('My Estimate');
    expect(getEstimate(est.id)).toStrictEqual(est);
  });

  it('adds service to estimate', () => {
    const est = createEstimate('Test');
    const service = {
      service_key: 'server',
      service_name: 'STACKIT Server',
      group: 'Production',
      config: { flavor: 'g1.2', quantity: 2 },
      monthly_cost_eur: 109.18,
    };
    addServiceToEstimate(est.id, service);
    expect(getEstimate(est.id)!.services).toHaveLength(1);
    expect(getEstimate(est.id)!.services[0].monthly_cost_eur).toBe(109.18);
  });

  it('throws for unknown estimate ID in addService', () => {
    expect(() => addServiceToEstimate('bad-id', {
      service_key: 'server', service_name: 'x', group: 'x', config: {}, monthly_cost_eur: 0,
    })).toThrow('Estimate bad-id not found');
  });
});
