import { describe, it, expect, vi, beforeEach } from 'vitest';

// Synthetic fixtures only — no real customer or project data.
const ENTRIES = [
  { customerAccountId: 'cust-a', projectId: 'p1', projectName: 'proj-one',   totalCharge: 8500, totalDiscount: 1500, reportData: [] },
  { customerAccountId: 'cust-a', projectId: 'p1', projectName: 'proj-one',   totalCharge: 1000, totalDiscount:    0, reportData: [] }, // same project, second period
  { customerAccountId: 'cust-a', projectId: 'p2', projectName: 'proj-two',   totalCharge: 6200, totalDiscount: 3800, reportData: [] },
  { customerAccountId: 'cust-b', projectId: 'p3', projectName: 'proj-three', totalCharge:  100, totalDiscount:    0, reportData: [] },
];

const PARTNERSHIPS = {
  partnerships: [
    { organizationId: 'cust-a', organizationName: 'Alpha GmbH', partnershipStatus: 'ACTIVE' },
    { organizationId: 'cust-b', organizationName: 'Beta GmbH',  partnershipStatus: 'ACTIVE' },
  ],
};

function mockClient(entries: unknown = ENTRIES) {
  vi.doMock('../src/api/client.js', () => ({
    partnerGet: vi.fn().mockImplementation((path: string) =>
      path.includes('/customers') ? Promise.resolve(entries) : Promise.resolve(PARTNERSHIPS)
    ),
  }));
}

describe('listCustomerProjects', () => {
  beforeEach(() => vi.resetModules());

  it('rolls up charge/discount per project and derives list/net/discount%', async () => {
    mockClient();
    const { listCustomerProjects } = await import('../src/tools/customer-projects.js');
    const res = await listCustomerProjects('org-x', { from: '2026-04-01', to: '2026-06-30' });

    expect(res.total_projects).toBe(3);

    const one = res.projects.find(p => p.project_id === 'p1')!;
    // net 8500+1000 = 9500 cents → 95.00; discount 1500 → 15.00; list → 110.00
    expect(one.net_eur).toBe(95);
    expect(one.discount_eur).toBe(15);
    expect(one.list_eur).toBe(110);
    expect(one.discount_pct).toBeCloseTo(13.64, 2);
    expect(one.customer_name).toBe('Alpha GmbH');

    // sorted by list price descending
    expect(res.projects[0].project_id).toBe('p1');
    // list: p1 110 + p2 100 (62 net + 38 disc) + p3 1 = 211; net: 95 + 62 + 1 = 158
    expect(res.total_list_eur).toBe(211);
    expect(res.total_net_eur).toBe(158);
  });

  it('filters to a single customer account', async () => {
    mockClient();
    const { listCustomerProjects } = await import('../src/tools/customer-projects.js');
    const res = await listCustomerProjects('org-x', { customerAccountId: 'cust-b' });

    expect(res.projects).toHaveLength(1);
    expect(res.projects[0].customer_account_id).toBe('cust-b');
    expect(res.projects[0].customer_name).toBe('Beta GmbH');
    expect(res.total_net_eur).toBe(1); // 100 cents
  });

  it('passes from/to/granularity to the cost endpoint', async () => {
    mockClient();
    const { listCustomerProjects } = await import('../src/tools/customer-projects.js');
    await listCustomerProjects('org-x', { from: '2026-05-01', to: '2026-05-31', granularity: 'daily' });

    const { partnerGet } = await import('../src/api/client.js');
    const calls = (partnerGet as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0] as string);
    expect(calls).toContain('/v3/costs/org-x/customers?from=2026-05-01&to=2026-05-31&granularity=daily');
  });

  it('returns no projects when the cost endpoint yields nothing', async () => {
    mockClient([]);
    const { listCustomerProjects } = await import('../src/tools/customer-projects.js');
    const res = await listCustomerProjects('org-x', {});
    expect(res.projects).toEqual([]);
    expect(res.total_projects).toBe(0);
    expect(res.total_list_eur).toBe(0);
  });
});
