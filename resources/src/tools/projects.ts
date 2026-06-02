import { stackitGet } from '../api/client.js';
import { getAccessToken } from '../auth/token.js';

interface Project {
  projectId: string;
  containerId: string;
  name: string;
  lifecycleState: string;
  parent?: { type: string; id: string };
  labels?: Record<string, string>;
}

function decodeJwtEmail(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const padded = payload + '='.repeat(-payload.length % 4);
    const data = JSON.parse(Buffer.from(padded, 'base64url').toString('utf8'));
    return data.email ?? data.sub ?? null;
  } catch { return null; }
}

export async function listProjects() {
  const token = await getAccessToken();
  const member = decodeJwtEmail(token);
  if (!member) throw new Error('Could not extract user identity from token.');

  const data = await stackitGet<{ items: Project[] }>(
    'resourceManager', `/v2/projects?member=${encodeURIComponent(member)}`
  );
  return {
    projects: (data.items ?? []).map(p => ({
      id: p.projectId,
      container_id: p.containerId,
      name: p.name,
      state: p.lifecycleState,
      parent_type: p.parent?.type,
    })),
  };
}
