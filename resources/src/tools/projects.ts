import { stackitGet } from '../api/client.js';

interface Project {
  projectId: string;
  name: string;
  state: string;
  labels?: Record<string, string>;
}

export async function listProjects() {
  const data = await stackitGet<{ items: Project[] }>('resourceManager', '/v1/projects');
  return {
    projects: (data.items ?? []).map(p => ({
      id: p.projectId,
      name: p.name,
      state: p.state,
    })),
  };
}
