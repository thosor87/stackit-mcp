#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loginWithKeyPath, clearToken } from './auth/token.js';
import { listProjects } from './tools/projects.js';
import { listServers, serverAction } from './tools/servers.js';
import { listDatabases } from './tools/databases.js';
import { listClusters } from './tools/kubernetes.js';
import { listObjectStorage } from './tools/storage.js';

const server = new McpServer({ name: 'stackit-resources', version: '0.1.0' });

// ── Auth ──────────────────────────────────────────────────────────────────────

server.tool(
  'auth_login',
  'Authenticate with STACKIT using a Service Account Key file. ' +
  'Checks STACKIT CLI credentials automatically if no path is provided.',
  {
    key_path: z.string().optional().describe(
      'Path to STACKIT Service Account Key JSON file. ' +
      'If omitted, uses STACKIT_SERVICE_ACCOUNT_KEY_PATH env var or STACKIT CLI credentials.'
    ),
    private_key_path: z.string().optional().describe(
      'Path to RSA private key PEM file (only needed if not embedded in the SA key file).'
    ),
  },
  async ({ key_path, private_key_path }) => {
    if (key_path) {
      await loginWithKeyPath(key_path, private_key_path);
      return { content: [{ type: 'text', text: 'Authenticated successfully. Token cached for 1 hour.' }] };
    }
    // Try auto-detect (CLI credentials or env var)
    try {
      const { getAccessToken } = await import('./auth/token.js');
      await getAccessToken();
      return { content: [{ type: 'text', text: 'Authenticated via STACKIT CLI credentials.' }] };
    } catch (e) {
      return {
        content: [{
          type: 'text',
          text: `Not authenticated.\n\nProvide the path to your Service Account Key:\n  auth_login({ key_path: "/path/to/sa-key.json" })\n\nOr set STACKIT_SERVICE_ACCOUNT_KEY_PATH in the MCP environment.`,
        }],
      };
    }
  }
);

server.tool(
  'auth_logout',
  'Clear the cached STACKIT authentication token.',
  {},
  async () => {
    clearToken();
    return { content: [{ type: 'text', text: 'Token cleared.' }] };
  }
);

// ── Resources ─────────────────────────────────────────────────────────────────

server.tool(
  'list_projects',
  'List all STACKIT projects accessible with the current credentials.',
  {},
  async () => {
    const result = await listProjects();
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'list_servers',
  'List all servers in a STACKIT project with status, flavor, and IPs.',
  { project_id: z.string().describe('STACKIT project ID') },
  async ({ project_id }) => {
    const result = await listServers(project_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'list_databases',
  'List all managed database instances (PostgreSQL Flex, MariaDB, Redis) in a project.',
  { project_id: z.string().describe('STACKIT project ID') },
  async ({ project_id }) => {
    const result = await listDatabases(project_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'list_clusters',
  'List STACKIT Kubernetes Engine (SKE) clusters in a project.',
  { project_id: z.string().describe('STACKIT project ID') },
  async ({ project_id }) => {
    const result = await listClusters(project_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'list_storage',
  'List Object Storage buckets in a STACKIT project.',
  { project_id: z.string().describe('STACKIT project ID') },
  async ({ project_id }) => {
    const result = await listObjectStorage(project_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'server_action',
  'Start, stop, or reboot a STACKIT server. Requires explicit confirmation.',
  {
    project_id: z.string().describe('STACKIT project ID'),
    server_id: z.string().describe('Server ID from list_servers'),
    action: z.enum(['start', 'stop', 'reboot']).describe('Action to perform'),
    confirm: z.boolean().describe('Must be true to execute — prevents accidental actions'),
  },
  async ({ project_id, server_id, action, confirm }) => {
    if (!confirm) {
      return { content: [{ type: 'text', text: `Action not executed. Set confirm: true to ${action} server ${server_id}.` }] };
    }
    const result = await serverAction(project_id, server_id, action);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[stackit-resources] Server running on stdio');
}

main().catch(e => {
  console.error('[stackit-resources] Fatal:', e);
  process.exit(1);
});
