import { describe, it, expect, beforeEach } from 'vitest';
import { resetStore } from '../src/estimate/store.js';
import { resetPriceCache } from '../src/pricing/loader.js';
import { handleCreateEstimate } from '../src/tools/create-estimate.js';
import { handleSearchServices } from '../src/tools/search-services.js';
import { handleGetServiceFields } from '../src/tools/get-service-fields.js';
import { handleAddService } from '../src/tools/add-service.js';
import { handleExportEstimate } from '../src/tools/export-estimate.js';

// Uses real bundled prices.json — no mocks
describe('E2E: TYPO3 3-Stage estimate using bundled prices', () => {
  beforeEach(() => {
    resetStore();
    resetPriceCache();
  });

  it('creates a 3-stage TYPO3 estimate and exports it', async () => {
    // 1. Search for server
    const search = await handleSearchServices({ query: 'server' });
    expect(search.services.some(s => s.service_key === 'server')).toBe(true);
    expect(search.price_source).toMatch(/^(live|cache|bundle)$/);

    // 2. Get server fields — verify real flavors exist
    const fields = await handleGetServiceFields({ service_key: 'server' });
    const flavorField = fields.fields.find((f: { id: string }) => f.id === 'flavor');
    expect(flavorField).toBeDefined();
    const flavorIds = (flavorField as { options: Array<{ id: string }> }).options.map(o => o.id);
    expect(flavorIds).toContain('g1.2');
    expect(flavorIds).toContain('g1.3');

    // 3. Create estimate
    const { estimate_id } = await handleCreateEstimate({ name: 'TYPO3 Infrastructure' });
    expect(estimate_id).toBeTruthy();

    // 4. Dev stage
    const devServer = await handleAddService({
      estimate_id, service_key: 'server', group: 'Dev',
      config: { flavor: 'g1.1', quantity: 1 },
    });
    expect(devServer.monthly_cost_eur).toBeGreaterThan(20);
    expect(devServer.monthly_cost_eur).toBeLessThan(40);

    // 5. Staging stage
    await handleAddService({
      estimate_id, service_key: 'server', group: 'Staging',
      config: { flavor: 'g1.2', quantity: 1 },
    });

    // 6. Production stage — 2x server
    const prodServer = await handleAddService({
      estimate_id, service_key: 'server', group: 'Production',
      config: { flavor: 'g1.2', quantity: 2 },
    });
    // 2x g1.2 should be ~2x the single price
    const singleG12 = await handleGetServiceFields({ service_key: 'server' });
    const g12Option = (singleG12.fields.find((f: { id: string }) => f.id === 'flavor') as { options: Array<{ id: string; price_month: number }> })
      .options.find(o => o.id === 'g1.2');
    expect(prodServer.monthly_cost_eur).toBeCloseTo((g12Option?.price_month ?? 0) * 2, 0);

    // 7. Add object storage to production
    await handleAddService({
      estimate_id, service_key: 'object-storage', group: 'Production',
      config: { storage_gb: 500 },
    });

    // 8. Export and verify
    const result = await handleExportEstimate({ estimate_id });

    expect(result.groups).toHaveLength(3);
    expect(result.groups.map(g => g.name).sort()).toEqual(['Dev', 'Production', 'Staging']);
    expect(result.total_month_eur).toBeGreaterThan(0);
    expect(result.total_year_eur).toBeCloseTo(result.total_month_eur * 12, 0);
    expect(result.calculator_url).toContain("addService=servers");
    expect(result.price_source).toMatch(/^(live|cache|bundle)$/);

    // Log summary for visibility
    console.log('\n=== TYPO3 E2E Estimate ===');
    console.log(`Total: €${result.total_month_eur}/month | €${result.total_year_eur}/year`);
    for (const g of result.groups) {
      console.log(`  ${g.name}: €${g.subtotal_month_eur}/month`);
    }
    console.log(`URL: ${result.calculator_url}`);
    console.log(`Source: ${result.price_source} (${result.price_date})`);
  }, 30_000);
});
