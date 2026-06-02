import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/pricing/loader.js', () => ({
  loadPrices: vi.fn(),
  resetPriceCache: vi.fn(),
}));

import { loadPrices } from '../src/pricing/loader.js';
import { resetStore } from '../src/estimate/store.js';
import { handleSearchServices } from '../src/tools/search-services.js';
import { handleGetServiceFields } from '../src/tools/get-service-fields.js';
import { handleCreateEstimate } from '../src/tools/create-estimate.js';
import { handleAddService } from '../src/tools/add-service.js';
import { handleExportEstimate } from '../src/tools/export-estimate.js';
import type { PriceData } from '../src/types.js';

const MOCK_PRICE_DATA: PriceData = {
  meta: { source: 'bundle', date: '2026-06-02', lastUpdatedAt: '2026-06-02T00:00:00Z' },
  skus: [
    {
      id: 'STA_1', sku: 'ST-0008501', title: 'General Purpose Server-g1.1-EU01',
      name: 'General Purpose Server-g1.1-EU01', region: 'eu01',
      category: 'Compute Engine', product: 'Server', unit: 'Hours', unitBilling: 'per hour',
      price: '0.03791', monthlyPrice: '27.2961599976', currency: '€',
      maturityModelState: 'ga', deprecated: 'No',
      attributes: { flavor: 'g1.1', vCPU: 1, ram: 4, metro: false },
      generalProductGroup: 'Server',
    },
    {
      id: 'STA_2', sku: 'ST-0007901', title: 'General Purpose Server-g1.2-EU01',
      name: 'General Purpose Server-g1.2-EU01', region: 'eu01',
      category: 'Compute Engine', product: 'Server', unit: 'Hours', unitBilling: 'per hour',
      price: '0.07582', monthlyPrice: '54.5923200024', currency: '€',
      maturityModelState: 'ga', deprecated: 'No',
      attributes: { flavor: 'g1.2', vCPU: 2, ram: 8, metro: false },
      generalProductGroup: 'Server',
    },
    {
      id: 'STA_3', sku: 'ST-OS001', title: 'Object Storage Premium-EU01',
      name: 'Object Storage Premium-EU01', region: 'eu01',
      category: 'Storage', product: 'Object Storage', unit: 'Gigabyte Hours', unitBilling: 'per gb/h',
      price: '0.00003697772', monthlyPrice: '0.0266239584', currency: '€',
      maturityModelState: 'ga', deprecated: 'No',
      attributes: {},
      generalProductGroup: 'Object Storage',
    },
  ],
};

describe('tools', () => {
  beforeEach(() => {
    vi.mocked(loadPrices).mockResolvedValue(MOCK_PRICE_DATA);
    resetStore();
  });

  describe('search_services', () => {
    it('returns matching services for query', async () => {
      const result = await handleSearchServices({ query: 'server' });
      expect(result.services.length).toBeGreaterThan(0);
      expect(result.services[0].service_key).toBe('server');
    });

    it('returns empty array for no match', async () => {
      const result = await handleSearchServices({ query: 'zzznomatch' });
      expect(result.services).toHaveLength(0);
    });
  });

  describe('get_service_fields', () => {
    it('returns fields for server', async () => {
      const result = await handleGetServiceFields({ service_key: 'server' });
      expect(result.service_key).toBe('server');
      expect(result.fields.length).toBeGreaterThan(0);
      const flavorField = result.fields.find((f: { id: string }) => f.id === 'flavor');
      expect(flavorField).toBeDefined();
    });

    it('throws for unknown service key', async () => {
      await expect(handleGetServiceFields({ service_key: 'unknown-xyz' }))
        .rejects.toThrow('Service unknown-xyz not found');
    });
  });

  describe('create_estimate', () => {
    it('creates estimate with default name', async () => {
      const result = await handleCreateEstimate({});
      expect(result.estimate_id).toBeTruthy();
      expect(result.name).toBe('My Estimate');
    });

    it('creates estimate with custom name', async () => {
      const result = await handleCreateEstimate({ name: 'Prod Setup' });
      expect(result.name).toBe('Prod Setup');
    });
  });

  describe('add_service', () => {
    it('adds server to estimate and returns monthly cost', async () => {
      const { estimate_id } = await handleCreateEstimate({});
      const result = await handleAddService({
        estimate_id,
        service_key: 'server',
        group: 'Production',
        config: { flavor: 'g1.2', quantity: 2 },
      });
      expect(result.monthly_cost_eur).toBeCloseTo(109.18, 0);
      expect(result.service_key).toBe('server');
    });

    it('throws for unknown estimate ID', async () => {
      await expect(handleAddService({
        estimate_id: 'bad-id', service_key: 'server', group: 'Dev', config: { flavor: 'g1.1', quantity: 1 },
      })).rejects.toThrow('Estimate bad-id not found');
    });

    it('throws for unknown service key', async () => {
      const { estimate_id } = await handleCreateEstimate({});
      await expect(handleAddService({
        estimate_id, service_key: 'unknown', group: 'Dev', config: {},
      })).rejects.toThrow('Service unknown not found');
    });
  });

  describe('export_estimate', () => {
    it('returns cost breakdown and calculator URL', async () => {
      const { estimate_id } = await handleCreateEstimate({ name: 'Test' });
      await handleAddService({ estimate_id, service_key: 'server', group: 'Prod', config: { flavor: 'g1.1', quantity: 1 } });

      const result = await handleExportEstimate({ estimate_id });
      expect(result.total_month_eur).toBeGreaterThan(0);
      expect(result.total_year_eur).toBeCloseTo(result.total_month_eur * 12, 1);
      expect(result.calculator_url).toContain('calculator.stackit.cloud');
      expect(result.calculator_url).toContain("addService=server");
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].name).toBe('Prod');
    });

    it('throws for unknown estimate', async () => {
      await expect(handleExportEstimate({ estimate_id: 'no-such' }))
        .rejects.toThrow('Estimate no-such not found');
    });
  });
});
