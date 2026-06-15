import { partnerGet } from './client.js';

export interface Partnership {
  partnershipId: string;
  organizationId: string;
  organizationName: string;
  type: string;
  partnershipStatus: 'ACTIVE' | 'PAST' | string;
  startDate?: { month: number; year: number };
  endDate?: { month: number; year: number };
}

interface PartnershipsResponse {
  partnerships: Partnership[];
}

export async function getPartnerships(orgId: string): Promise<Map<string, Partnership>> {
  const data = await partnerGet<PartnershipsResponse>(
    `/v1/partners/${orgId}/partnerships`
  );
  const map = new Map<string, Partnership>();
  for (const p of data.partnerships ?? []) {
    map.set(p.organizationId, p);
  }
  return map;
}
