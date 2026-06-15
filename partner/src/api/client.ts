import { getAccessToken } from '../auth/token.js';

const COST_BASE    = 'https://cost.api.stackit.cloud';
const PARTNER_BASE = 'https://partner.api.stackit.cloud';

export async function partnerGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const base = path.startsWith('/v1/partners') ? PARTNER_BASE : COST_BASE;
  const url = `${base}${path}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Partner API ${resp.status} — ${url}\n${body}`);
  }
  return resp.json() as Promise<T>;
}
