import { partnerGet } from '../api/client.js';
import { getPartnerships } from '../api/partnerships.js';

interface ApiProjectEntry {
  customerAccountId: string;
  projectId: string;
  projectName: string;
  totalCharge: number;   // in EUR cents
  totalDiscount: number; // in EUR cents
  reportData: unknown[];
}

function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrevMonth  = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { from: fmt(firstOfPrevMonth), to: fmt(lastOfPrevMonth) };
}

export interface CustomerSummary {
  customer_account_id: string;
  name: string;
  partnership_status: string;
  gross_eur: number;
  discount_eur: number;
  net_eur: number;
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
      const grossEur    = c.chargeCents / 100;
      const discountEur = c.discountCents / 100;
      const projectsByCharge = [...c.projects.entries()].sort((a, b) => b[1] - a[1]);
      const partnership = partnerships.get(id);
      return {
        customer_account_id: id,
        name:             partnership?.organizationName ?? id,
        partnership_status: partnership?.partnershipStatus ?? 'UNKNOWN',
        gross_eur:      Math.round(grossEur * 100) / 100,
        discount_eur:   Math.round(discountEur * 100) / 100,
        net_eur:        Math.round((grossEur - discountEur) * 100) / 100,
        project_count:  c.projects.size,
        top_project:    projectsByCharge[0]?.[0] ?? '',
        projects:       projectsByCharge.map(([name]) => name),
      };
    })
    .sort((a, b) => b.gross_eur - a.gross_eur);

  return { customers, from, to, total_customers: customers.length };
}
