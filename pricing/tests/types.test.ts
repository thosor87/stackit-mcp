import { describe, it, expect } from 'vitest';
import type { PriceData, Estimate, EstimateService } from '../src/types.js';

describe('types', () => {
  it('PriceData has required shape', () => {
    const data: PriceData = {
      meta: { source: 'bundle', date: '2026-06-02', lastUpdatedAt: '2026-06-02T00:00:00Z' },
      skus: [],
    };
    expect(data.meta.source).toBe('bundle');
    expect(Array.isArray(data.skus)).toBe(true);
  });

  it('Estimate has required shape', () => {
    const est: Estimate = {
      id: 'abc',
      name: 'Test',
      services: [],
      createdAt: new Date().toISOString(),
    };
    expect(est.services).toHaveLength(0);
  });
});
