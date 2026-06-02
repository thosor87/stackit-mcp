#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleSearchServices } from './tools/search-services.js';
import { handleGetServiceFields } from './tools/get-service-fields.js';
import { handleCreateEstimate } from './tools/create-estimate.js';
import { handleAddService } from './tools/add-service.js';
import { handleExportEstimate } from './tools/export-estimate.js';
import { handleSaveEstimate } from './tools/save-estimate.js';

const server = new McpServer({
  name: 'stackit-mcp',
  version: '0.1.0',
});

server.tool(
  'search_services',
  'Search available STACKIT services for pricing estimates (e.g. "server", "database", "storage")',
  { query: z.string().describe('Search term') },
  async ({ query }) => {
    const result = await handleSearchServices({ query });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'get_service_fields',
  'Get configurable fields and pricing options for a STACKIT service',
  { service_key: z.string().describe('Service key from search_services, e.g. "server"') },
  async ({ service_key }) => {
    const result = await handleGetServiceFields({ service_key });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'create_estimate',
  'Create a new STACKIT cost estimate',
  { name: z.string().optional().describe('Estimate name (default: "My Estimate")') },
  async ({ name }) => {
    const result = await handleCreateEstimate({ name });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'add_service',
  'Add a STACKIT service to an estimate and get its monthly price',
  {
    estimate_id: z.string().describe('Estimate ID from create_estimate'),
    service_key: z.string().describe('Service key, e.g. "server"'),
    group: z.string().optional().describe('Group label, e.g. "Production", "Dev"'),
    config: z.record(z.string(), z.unknown()).describe('Service configuration, e.g. {"flavor": "g1.2", "quantity": 2}'),
  },
  async ({ estimate_id, service_key, group, config }) => {
    const result = await handleAddService({ estimate_id, service_key, group, config: config as Record<string, unknown> });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'export_estimate',
  'Export a STACKIT estimate: get full cost breakdown and a calculator.stackit.cloud link',
  { estimate_id: z.string().describe('Estimate ID from create_estimate') },
  async ({ estimate_id }) => {
    const result = await handleExportEstimate({ estimate_id });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'save_estimate',
  'Save a STACKIT estimate as .md and .csv files to disk (default: /tmp)',
  {
    estimate_id: z.string().describe('Estimate ID from create_estimate'),
    directory: z.string().optional().describe('Target directory (default: ~/Downloads)'),
  },
  async ({ estimate_id, directory }) => {
    const result = await handleSaveEstimate({ estimate_id, directory });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[stackit-mcp] Server running on stdio');
}

main().catch(e => {
  console.error('[stackit-mcp] Fatal:', e);
  process.exit(1);
});
