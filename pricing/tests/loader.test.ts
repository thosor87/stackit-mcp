import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/pricing/api.js', () => ({
  fetchSkus: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

import { fetchSkus } from '../src/pricing/api.js';
import { stat, readFile } from 'node:fs/promises';

describe('price loader', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('falls back to bundle when API throws', async () => {
    vi.mocked(stat).mockRejectedValue(new Error('no cache'));
    vi.mocked(fetchSkus).mockRejectedValue(new Error('network error'));

    const { loadPrices } = await import('../src/pricing/loader.js');
    const data = await loadPrices();

    expect(data.meta.source).toBe('bundle');
    expect(Array.isArray(data.skus)).toBe(true);
    expect(data.skus.length).toBeGreaterThan(0);
  });

  it('uses live data when API succeeds', async () => {
    vi.mocked(stat).mockRejectedValue(new Error('no cache'));
    vi.mocked(fetchSkus).mockResolvedValue({
      meta: { source: 'live', date: '2026-06-02', lastUpdatedAt: '2026-06-02T00:00:00Z' },
      skus: [{ id: 'test', sku: 'ST-0001', title: 'Test', name: 'Test', region: 'eu01',
        category: 'Compute Engine', product: 'Server', unit: 'Hours', unitBilling: 'per hour',
        price: '0.038', monthlyPrice: '27.30', currency: '€', maturityModelState: 'ga',
        deprecated: 'No', attributes: { flavor: 'g1.1', vCPU: 1, ram: 4 },
        generalProductGroup: 'Server' }],
    });

    const { loadPrices } = await import('../src/pricing/loader.js');
    const data = await loadPrices();

    expect(data.meta.source).toBe('live');
    expect(data.skus).toHaveLength(1);
  });

  it('caches the result in memory after first load', async () => {
    vi.mocked(stat).mockRejectedValue(new Error('no cache'));
    vi.mocked(fetchSkus).mockRejectedValue(new Error('network error'));

    const { loadPrices } = await import('../src/pricing/loader.js');
    await loadPrices();
    await loadPrices();

    // fetchSkus called only once — memory cache hit on second call
    expect(vi.mocked(fetchSkus)).toHaveBeenCalledTimes(1);
  });
});
