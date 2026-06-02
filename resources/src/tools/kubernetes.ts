import { stackitGet } from '../api/client.js';

interface Cluster {
  name: string;
  status?: { state?: string };
  kubernetes?: { version?: string };
  nodePools?: Array<{ name: string; machineType?: string; minimum?: number; maximum?: number }>;
}

export async function listClusters(projectId: string) {
  const data = await stackitGet<{ items: Cluster[] }>(
    'ske', `/v1/projects/${projectId}/clusters`
  );
  return {
    clusters: (data.items ?? []).map(c => ({
      name: c.name,
      status: c.status?.state,
      k8s_version: c.kubernetes?.version,
      node_pools: (c.nodePools ?? []).map(p => ({
        name: p.name,
        machine_type: p.machineType,
        min: p.minimum,
        max: p.maximum,
      })),
    })),
  };
}
