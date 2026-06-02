import { stackitGet } from '../api/client.js';

interface Cluster {
  name: string;
  status?: { state?: string };
  kubernetes?: { version?: string };
  nodePools?: Array<{ name: string; machineType?: string; minimum?: number; maximum?: number }>;
}

export async function listClusters(projectId: string) {
  let data: { items: Cluster[] };
  try {
    data = await stackitGet<{ items: Cluster[] }>(
      'ske', `/v1/projects/${projectId}/clusters`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('403') || msg.includes('not enabled') || msg.includes('404')) {
      return { clusters: [], note: 'SKE not enabled in this project.' };
    }
    throw e;
  }
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
