import { stackitGet } from '../api/client.js';

interface DbInstance {
  id: string;
  name: string;
  status: string;
  flavor?: { cpu?: number; ram?: number; description?: string };
  replicas?: number;
  version?: string;
}

export async function listDatabases(projectId: string) {
  const [pg, mariadb, redis] = await Promise.allSettled([
    stackitGet<{ items: DbInstance[] }>('postgresFlex', `/v1/projects/${projectId}/instances`),
    stackitGet<{ items: DbInstance[] }>('mariadb', `/v1/projects/${projectId}/instances`),
    stackitGet<{ items: DbInstance[] }>('redis', `/v1/projects/${projectId}/instances`),
  ]);

  const results: Array<{ type: string; id: string; name: string; status: string; plan?: string }> = [];

  if (pg.status === 'fulfilled') {
    for (const i of pg.value.items ?? []) {
      results.push({ type: 'PostgreSQL Flex', id: i.id, name: i.name, status: i.status, plan: i.flavor?.description });
    }
  }
  if (mariadb.status === 'fulfilled') {
    for (const i of mariadb.value.items ?? []) {
      results.push({ type: 'MariaDB', id: i.id, name: i.name, status: i.status, plan: i.flavor?.description });
    }
  }
  if (redis.status === 'fulfilled') {
    for (const i of redis.value.items ?? []) {
      results.push({ type: 'Redis', id: i.id, name: i.name, status: i.status });
    }
  }

  return { databases: results };
}
