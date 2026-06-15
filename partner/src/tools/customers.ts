import { partnerGet } from '../api/client.js';

interface ApiCustomer {
  organizationId?: string;
  id?: string;
  organizationName?: string;
  name?: string;
  type?: string;
  totalCost?: number;
  cost?: number;
}

interface ApiCustomersResponse {
  customers?: ApiCustomer[];
  items?: ApiCustomer[];
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

export async function listCustomers(
  orgId: string,
  opts: { from?: string; to?: string; granularity?: 'daily' | 'monthly' }
) {
  const defaults = previousMonthRange();
  const params = new URLSearchParams({
    from:        opts.from        ?? defaults.from,
    to:          opts.to          ?? defaults.to,
    granularity: opts.granularity ?? 'monthly',
  });

  const data = await partnerGet<ApiCustomersResponse>(
    `/v3/costs/${orgId}/customers?${params}`
  );

  const raw = data.customers ?? data.items ?? [];
  return {
    customers: raw.map(c => ({
      id:             c.organizationId ?? c.id ?? '',
      name:           c.organizationName ?? c.name ?? '',
      type:           c.type ?? '',
      total_cost_eur: c.totalCost ?? c.cost ?? null,
    })),
  };
}
