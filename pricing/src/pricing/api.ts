import type { PimApiResponse, PriceData } from '../types.js';

const PIM_API_URL = 'https://pim.api.stackit.cloud/v1/skus';
const DEFAULT_REGION = 'eu01';

export async function fetchSkus(region: string = DEFAULT_REGION): Promise<PriceData> {
  const url = `${PIM_API_URL}?region=${encodeURIComponent(region)}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'stackit-mcp/0.1.0' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`STACKIT PIM API error: ${response.status} ${response.statusText}`);
  }

  const raw: PimApiResponse = await response.json() as PimApiResponse;

  return {
    meta: {
      source: 'live',
      date: new Date().toISOString().split('T')[0],
      lastUpdatedAt: raw.lastUpdatedAt,
    },
    skus: raw.services,
  };
}
