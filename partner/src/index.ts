#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loginInteractive, clearToken, saveTokenFromRaw } from './auth/token.js';
import { listCustomers } from './tools/customers.js';

const server = new McpServer({ name: 'stackit-partner', version: '0.1.0' });

function getOrgId(): string {
  const id = process.env['STACKIT_PARTNER_ORG_ID'];
  if (!id) throw new Error(
    'STACKIT_PARTNER_ORG_ID is not set. Add it to your MCP env config.'
  );
  return id;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

server.tool(
  'auth_login',
  'Log in to the STACKIT Partner Portal. Opens a browser window for authentication.',
  {},
  async () => {
    const url = await loginInteractive();
    const { execFile } = await import('child_process');
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    execFile(cmd, [url], () => { /* ignore errors */ });
    return {
      content: [{
        type: 'text',
        text: `Opening STACKIT Partner Portal login in your browser...\n\nIf the browser didn't open, copy this URL:\n${url}\n\nAfter logging in, call list_customers — the token will be ready.`,
      }],
    };
  }
);

server.tool(
  'auth_set_token',
  'Manually set a Bearer token copied from the browser (Network tab → Authorization header). The token expiry is parsed from the JWT automatically.',
  { token: z.string().describe('Bearer token value (without the "Bearer " prefix)') },
  async ({ token }) => {
    saveTokenFromRaw(token.replace(/^Bearer\s+/i, ''));
    return { content: [{ type: 'text', text: '✓ Token saved. Call list_customers to verify.' }] };
  }
);

server.tool(
  'auth_logout',
  'Clear the cached STACKIT Partner Portal authentication token.',
  {},
  async () => {
    clearToken();
    return { content: [{ type: 'text', text: 'Partner Portal token cleared.' }] };
  }
);

// ── Customer Relations ────────────────────────────────────────────────────────

server.tool(
  'list_customers',
  'List all customer organizations in the STACKIT Partner Portal with optional cost data for a date range.',
  {
    from: z.string().optional().describe('Start date YYYY-MM-DD (default: first day of previous month)'),
    to:   z.string().optional().describe('End date YYYY-MM-DD (default: last day of previous month)'),
    granularity: z.enum(['daily', 'monthly']).optional().describe('Cost granularity (default: monthly)'),
  },
  async ({ from, to, granularity }) => {
    const result = await listCustomers(getOrgId(), { from, to, granularity });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[stackit-partner] Server running on stdio');
}

main().catch(e => {
  console.error('[stackit-partner] Fatal:', e);
  process.exit(1);
});
