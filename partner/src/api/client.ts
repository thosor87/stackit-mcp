import { getAccessToken } from '../auth/token.js';

const BASE_URL = 'https://cost.api.stackit.cloud';

export async function partnerGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const url = `${BASE_URL}${path}`;
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
