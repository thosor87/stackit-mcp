import { describe, it, expect, vi, beforeEach } from 'vitest';

// Synthetic fixtures only — no real customer or project data.
const ENTRIES = [
  { customerAccountId: 'id-1', projectId: 'p1', projectName: 'proj-one', totalCharge: 6200, totalDiscount: 3800, reportData: [] },
  { customerAccountId: 'id-1', projectId: 'p2', projectName: 'proj-two', totalCharge: 3100, totalDiscount: 1900, reportData: [] },
];

const PARTNERSHIPS = {
  partnerships: [
    { organizationId: 'id-1', organizationName: 'Acme GmbH', partnershipStatus: 'ACTIVE' },
  ],
};

function mockClient(entries: unknown = ENTRIES) {
  vi.doMock('../src/api/client.js', () => ({
    partnerGet: vi.fn().mockImplementation((path: string) =>
      path.includes('/customers') ? Promise.resolve(entries) : Promise.resolve(PARTNERSHIPS)
    ),
  }));
}

describe('listCustomers', () => {
  beforeEach(() => vi.resetModules());

  it('passes from/to/granularity to the API and aggregates a customer', async () => {
    mockClient();
    const { listCustomers } = await import('../src/tools/customers.js');
    const result = await listCustomers('org-uuid', { from: '2026-05-01', to: '2026-05-31', granularity: 'monthly' });

    const { partnerGet } = await import('../src/api/client.js');
    const calls = (partnerGet as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0] as string);
    expect(calls).toContain('/v3/costs/org-uuid/customers?from=2026-05-01&to=2026-05-31&granularity=monthly');

    expect(result.customers).toHaveLength(1);
    expect(result.customers[0]).toMatchObject({
      customer_account_id: 'id-1',
      name: 'Acme GmbH',
      partnership_status: 'ACTIVE',
      net_eur: 93,      // (6200 + 3100) / 100
      discount_eur: 57, // (3800 + 1900) / 100
      list_eur: 150,
      discount_pct: 38,
      project_count: 2,
    });
  });

  it('uses previous-month defaults when no dates provided', async () => {
    mockClient([]);
    const { listCustomers } = await import('../src/tools/customers.js');
    await listCustomers('org-uuid', {});

    const { partnerGet } = await import('../src/api/client.js');
    const calledUrl = (partnerGet as ReturnType<typeof vi.fn>).mock.calls
      .map(c => c[0] as string)
      .find(u => u.includes('/v3/costs/'))!;
    // Defaults: from = first day of previous month, to = last day of previous month
    expect(calledUrl).toMatch(/from=\d{4}-\d{2}-01/);
    expect(calledUrl).toMatch(/to=\d{4}-\d{2}-\d{2}/);
    expect(calledUrl).toContain('granularity=monthly');
  });

  it('returns an empty array when the cost endpoint yields nothing', async () => {
    mockClient([]);
    const { listCustomers } = await import('../src/tools/customers.js');
    const result = await listCustomers('org-uuid', {});
    expect(result.customers).toEqual([]);
    expect(result.total_customers).toBe(0);
  });
});
