import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('listCustomers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('passes from/to/granularity to the API', async () => {
    const mockData = {
      customers: [
        { organizationId: 'id-1', organizationName: 'Acme GmbH', type: 'Reseller', totalCost: 1200.50 },
      ],
    };
    vi.doMock('../src/api/client.js', () => ({
      partnerGet: vi.fn().mockResolvedValue(mockData),
    }));

    const { listCustomers } = await import('../src/tools/customers.js');
    const result = await listCustomers('org-uuid', { from: '2026-05-01', to: '2026-05-31', granularity: 'monthly' });

    const { partnerGet } = await import('../src/api/client.js');
    expect(partnerGet).toHaveBeenCalledWith(
      '/v3/costs/org-uuid/customers?from=2026-05-01&to=2026-05-31&granularity=monthly'
    );
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0]).toMatchObject({
      id: 'id-1',
      name: 'Acme GmbH',
      type: 'Reseller',
      total_cost_eur: 1200.50,
    });
  });

  it('uses previous-month defaults when no dates provided', async () => {
    vi.doMock('../src/api/client.js', () => ({
      partnerGet: vi.fn().mockResolvedValue({ customers: [] }),
    }));

    const { listCustomers } = await import('../src/tools/customers.js');
    await listCustomers('org-uuid', {});

    const { partnerGet } = await import('../src/api/client.js');
    const calledUrl = (partnerGet as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // Defaults: from = first day of previous month, to = last day of previous month
    expect(calledUrl).toMatch(/from=\d{4}-\d{2}-01/);
    expect(calledUrl).toMatch(/to=\d{4}-\d{2}-\d{2}/);
    expect(calledUrl).toContain('granularity=monthly');
  });

  it('returns empty array when API returns no customers field', async () => {
    vi.doMock('../src/api/client.js', () => ({
      partnerGet: vi.fn().mockResolvedValue({}),
    }));

    const { listCustomers } = await import('../src/tools/customers.js');
    const result = await listCustomers('org-uuid', {});
    expect(result.customers).toEqual([]);
  });
});
