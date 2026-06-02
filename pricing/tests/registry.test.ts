import { describe, it, expect } from 'vitest';
import type { StackitSku } from '../src/types.js';
import { buildRegistry, searchServices, getServiceDefinition } from '../src/pricing/registry.js';

const MOCK_SKUS: StackitSku[] = [
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
];

describe('service registry', () => {
  it('builds a registry from SKUs', () => {
    const registry = buildRegistry(MOCK_SKUS);
    expect(registry.has('server')).toBe(true);
    expect(registry.has('object-storage')).toBe(true);
  });

  it('search returns matching services', () => {
    const registry = buildRegistry(MOCK_SKUS);
    const results = searchServices(registry, 'server');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].service_key).toBe('server');
  });

  it('search is case-insensitive', () => {
    const registry = buildRegistry(MOCK_SKUS);
    const results = searchServices(registry, 'STORAGE');
    expect(results.some(r => r.service_key === 'object-storage')).toBe(true);
  });

  it('getServiceDefinition returns flavor options for server', () => {
    const registry = buildRegistry(MOCK_SKUS);
    const def = getServiceDefinition(registry, 'server');
    expect(def).not.toBeNull();
    const flavorField = def!.fields.find(f => f.id === 'flavor');
    expect(flavorField?.options).toHaveLength(2);
    expect(flavorField?.options?.[0].id).toBe('g1.1');
    expect(flavorField?.options?.[0].price_month).toBeCloseTo(27.30, 0);
  });

  it('getServiceDefinition returns per-gb price for object-storage', () => {
    const registry = buildRegistry(MOCK_SKUS);
    const def = getServiceDefinition(registry, 'object-storage');
    expect(def).not.toBeNull();
    const storageField = def!.fields.find(f => f.id === 'storage_gb');
    expect(storageField?.price_per_gb_month).toBeGreaterThan(0);
  });
});
