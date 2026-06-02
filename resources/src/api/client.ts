import { getAccessToken } from '../auth/token.js';

const BASE: Record<string, string> = {
  resourceManager: 'https://resource-manager.api.stackit.cloud',
  iaas:            'https://iaas.api.eu01.stackit.cloud',
  postgresFlex:    'https://postgres-flex.api.eu01.stackit.cloud',
  mariadb:         'https://mariadb.api.eu01.stackit.cloud',
  redis:           'https://redis.api.eu01.stackit.cloud',
  ske:             'https://ske.api.eu01.stackit.cloud',
  objectStorage:   'https://object-storage.api.stackit.cloud',
};

export async function stackitGet<T>(service: keyof typeof BASE, path: string): Promise<T> {
  const token = await getAccessToken();
  const url = `${BASE[service]}${path}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`STACKIT API ${resp.status} — ${url}\n${body}`);
  }
  return resp.json() as Promise<T>;
}

export async function stackitPost<T>(
  service: keyof typeof BASE,
  path: string,
  body: unknown
): Promise<T> {
  const token = await getAccessToken();
  const url = `${BASE[service]}${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`STACKIT API ${resp.status} — ${url}\n${text}`);
  }
  return resp.json() as Promise<T>;
}
