import { stackitGet, stackitPost } from '../api/client.js';

interface Server {
  id: string;
  name: string;
  status: string;
  machineType?: string;
  availabilityZone?: string;
  networks?: Array<{ ips?: Array<{ ip: string }> }>;
  volumes?: Array<{ id: string }>;
}

export async function listServers(projectId: string) {
  const data = await stackitGet<{ items: Server[] }>(
    'iaas', `/v1/projects/${projectId}/servers`
  );
  return {
    servers: (data.items ?? []).map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      flavor: s.machineType,
      zone: s.availabilityZone,
      ips: s.networks?.flatMap(n => n.ips?.map(i => i.ip) ?? []) ?? [],
    })),
  };
}

export async function serverAction(
  projectId: string,
  serverId: string,
  action: 'start' | 'stop' | 'reboot'
) {
  await stackitPost<unknown>(
    'iaas',
    `/v1/projects/${projectId}/servers/${serverId}/${action}`,
    {}
  );
  return { success: true, action, serverId };
}
