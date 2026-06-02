#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loginWithKeyPath, loginInteractive, clearToken } from './auth/token.js';
import { listProjects } from './tools/projects.js';
import { listServers, serverAction } from './tools/servers.js';
import { listDatabases } from './tools/databases.js';
import { listClusters } from './tools/kubernetes.js';
import { listObjectStorage } from './tools/storage.js';

const server = new McpServer({ name: 'stackit-resources', version: '0.1.0' });

// ── Auth ──────────────────────────────────────────────────────────────────────

server.tool(
  'auth_login',
  'Log in to STACKIT. Without arguments: opens browser for interactive login (same as "stackit auth login"). ' +
  'With key_path: authenticates via Service Account Key. Auto-detects existing STACKIT CLI session.',
  {
    key_path: z.string().optional().describe(
      'Path to STACKIT Service Account Key JSON (optional — omit for interactive browser login).'
    ),
    private_key_path: z.string().optional().describe(
      'Path to RSA private key PEM (only needed if not embedded in the SA key file).'
    ),
  },
  async ({ key_path, private_key_path }) => {
    // SA key path explicitly provided
    if (key_path) {
      await loginWithKeyPath(key_path, private_key_path);
      return { content: [{ type: 'text', text: '✓ Authenticated via Service Account Key. Token cached for 1 hour.' }] };
    }

    // Try auto-detect first (existing CLI session or SA key env var)
    try {
      const { getAccessToken } = await import('./auth/token.js');
      await getAccessToken();
      return { content: [{ type: 'text', text: '✓ Authenticated (existing STACKIT session detected).' }] };
    } catch { /* not yet authenticated — proceed with interactive login */ }

    // Interactive PKCE login (same flow as `stackit auth login`)
    const url = await loginInteractive();

    // Try to auto-open browser (macOS/Linux)
    const { exec } = await import('child_process');
    const openCmd = process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(openCmd, () => { /* ignore errors */ });

    return {
      content: [{
        type: 'text',
        text: `Opening STACKIT login in your browser...\n\nIf the browser didn't open, copy this URL:\n${url}\n\nAfter logging in, call list_projects or any other tool — the token will be ready.`,
      }],
    };
  }
);

// In-process default project (survives within one MCP session)
let defaultProjectId: string | null = null;

server.tool(
  'set_project',
  'Set the default STACKIT project for this session. After calling this, all other tools work without needing a project_id.',
  { project_id: z.string().describe('STACKIT project ID (UUID)') },
  async ({ project_id }) => {
    defaultProjectId = project_id;
    return { content: [{ type: 'text', text: `Default project set to: ${project_id}` }] };
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

function resolveProject(project_id?: string): string {
  const id = project_id ?? defaultProjectId;
  if (!id) throw new Error('No project_id provided. Use set_project first or pass project_id explicitly.');
  return id;
}

server.tool(
  'list_servers',
  'List all servers in a STACKIT project with status, flavor, and IPs.',
  { project_id: z.string().optional().describe('STACKIT project ID (uses session default if omitted)') },
  async ({ project_id }) => {
    const result = await listServers(resolveProject(project_id));
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'list_databases',
  'List all managed database instances (PostgreSQL Flex, MariaDB, Redis) in a project.',
  { project_id: z.string().optional().describe('STACKIT project ID (uses session default if omitted)') },
  async ({ project_id }) => {
    const result = await listDatabases(resolveProject(project_id));
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'list_clusters',
  'List STACKIT Kubernetes Engine (SKE) clusters in a project.',
  { project_id: z.string().optional().describe('STACKIT project ID (uses session default if omitted)') },
  async ({ project_id }) => {
    const result = await listClusters(resolveProject(project_id));
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'list_storage',
  'List Object Storage buckets in a STACKIT project.',
  { project_id: z.string().optional().describe('STACKIT project ID (uses session default if omitted)') },
  async ({ project_id }) => {
    const result = await listObjectStorage(resolveProject(project_id));
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'server_action',
  'Start, stop, or reboot a STACKIT server. Requires explicit confirmation.',
  {
    project_id: z.string().optional().describe('STACKIT project ID (uses session default if omitted)'),
    server_id: z.string().describe('Server ID from list_servers'),
    action: z.enum(['start', 'stop', 'reboot']).describe('Action to perform'),
    confirm: z.boolean().describe('Must be true to execute — prevents accidental actions'),
  },
  async ({ project_id, server_id, action, confirm }) => {
    if (!confirm) {
      return { content: [{ type: 'text', text: `Action not executed. Set confirm: true to ${action} server ${server_id}.` }] };
    }
    const result = await serverAction(resolveProject(project_id), server_id, action);
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
