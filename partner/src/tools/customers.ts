import { partnerGet } from '../api/client.js';
import { getPartnerships } from '../api/partnerships.js';
import { previousMonthRange } from '../util/dates.js';

interface ApiProjectEntry {
  customerAccountId: string;
  projectId: string;
  projectName: string;
  totalCharge: number;   // net charge after discounts, in EUR cents (spec: "Total charge including discounts")
  totalDiscount: number; // discount amount subtracted from list price, in EUR cents
  reportData: unknown[];
}

export interface CustomerSummary {
  customer_account_id: string;
  name: string;
  partnership_status: string;
  list_eur: number;      // gross list price = totalCharge + totalDiscount
  discount_eur: number;  // discount amount (totalDiscount)
  net_eur: number;       // what customer pays (totalCharge, already includes discounts per spec)
  discount_pct: number;  // discount as % of list price
  project_count: number;
  top_project: string;
  projects: string[];
}

export async function listCustomers(
  orgId: string,
  opts: { from?: string; to?: string; granularity?: 'daily' | 'monthly' }
): Promise<{ customers: CustomerSummary[]; from: string; to: string; total_customers: number }> {
  const defaults = previousMonthRange();
  const from = opts.from ?? defaults.from;
  const to   = opts.to   ?? defaults.to;
  const params = new URLSearchParams({
    from,
    to,
    granularity: opts.granularity ?? 'monthly',
  });

  // Fetch both cost data and partnership names in parallel
  const [entries, partnerships] = await Promise.all([
    partnerGet<ApiProjectEntry[]>(`/v3/costs/${orgId}/customers?${params}`),
    getPartnerships(orgId),
  ]);

  // Group by customerAccountId
  const byCustomer = new Map<string, {
    chargeCents: number;
    discountCents: number;
    projects: Map<string, number>; // projectName → charge
  }>();

  for (const e of entries) {
    let c = byCustomer.get(e.customerAccountId);
    if (!c) {
      c = { chargeCents: 0, discountCents: 0, projects: new Map() };
      byCustomer.set(e.customerAccountId, c);
    }
    c.chargeCents += e.totalCharge;
    c.discountCents += e.totalDiscount;
    c.projects.set(e.projectName, (c.projects.get(e.projectName) ?? 0) + e.totalCharge);
  }

  const customers: CustomerSummary[] = Array.from(byCustomer.entries())
    .map(([id, c]) => {
      // totalCharge = net (spec: "including discounts"), totalDiscount = discount amount
      const netEur      = c.chargeCents / 100;
      const discountEur = c.discountCents / 100;
      const listEur     = netEur + discountEur;
      const discountPct = listEur > 0 ? Math.round((discountEur / listEur) * 10000) / 100 : 0;
      const projectsByCharge = [...c.projects.entries()].sort((a, b) => b[1] - a[1]);
      const partnership = partnerships.get(id);
      return {
        customer_account_id: id,
        name:               partnership?.organizationName ?? id,
        partnership_status: partnership?.partnershipStatus ?? 'UNKNOWN',
        list_eur:           Math.round(listEur * 100) / 100,
        discount_eur:       Math.round(discountEur * 100) / 100,
        net_eur:            Math.round(netEur * 100) / 100,
        discount_pct:       discountPct,
        project_count:      c.projects.size,
        top_project:        projectsByCharge[0]?.[0] ?? '',
        projects:           projectsByCharge.map(([name]) => name),
      };
    })
    .sort((a, b) => b.list_eur - a.list_eur);

  return { customers, from, to, total_customers: customers.length };
}
