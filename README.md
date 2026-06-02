# stackit-mcp

MCP server that lets Claude and other AI assistants create cost estimates for STACKIT cloud services.

[![Install in Claude Code](https://img.shields.io/badge/Claude_Code-Install_stackit--mcp-CC785C?style=flat-square&logo=anthropic&logoColor=white)](#installation)
[![Install in Cursor](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=stackit-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInN0YWNraXQtbWNwQGxhdGVzdCJdfQ==)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_stackit--mcp-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=stackit-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInN0YWNraXQtbWNwQGxhdGVzdCJdfQ==)
[![npm version](https://img.shields.io/npm/v/stackit-mcp?style=flat-square)](https://www.npmjs.com/package/stackit-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥18-green?style=flat-square&logo=node.js)](https://nodejs.org)

---

## Features

- **Search STACKIT services** by name, category, or keyword
- **Inspect configurable fields** — instance flavors, storage sizes, cluster counts, and real pricing options
- **Build named estimates** with multiple services and logical groups (e.g. Dev / Staging / Production)
- **Instant monthly costs** calculated from live STACKIT pricing the moment a service is added
- **Full cost breakdown** with group subtotals, monthly and annual totals
- **Deep link to calculator.stackit.cloud** — export opens the interactive STACKIT calculator with services pre-selected
- **Three-tier pricing** — live STACKIT PIM API, 24-hour disk cache, bundled fallback (723 SKUs, eu01 region)
- **Price source transparency** — every response tells you whether pricing is live, cached, or from the bundle

---

## Installation

### Option A — npx (recommended)

No installation required. Add to your MCP client configuration:

**Claude Code** (`~/.claude.json`):
```json
{
  "mcpServers": {
    "stackit-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "stackit-mcp@latest"]
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "stackit-mcp": {
      "command": "npx",
      "args": ["-y", "stackit-mcp@latest"]
    }
  }
}
```

**VS Code** (`.vscode/mcp.json` or user settings):
```json
{
  "servers": {
    "stackit-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "stackit-mcp@latest"]
    }
  }
}
```

### Option B — Local build from GitHub

```bash
git clone https://github.com/thosor87/stackit-mcp
cd stackit-mcp
npm install && npm run build
```

Then point your MCP client at the compiled entry point:

```json
{
  "mcpServers": {
    "stackit-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/stackit-mcp/dist/index.js"]
    }
  }
}
```

---

## Usage

Once configured, just ask Claude to build a STACKIT cost estimate in natural language.

**Example conversation:**

```
You: Erstelle eine STACKIT-Kostenkalkulation für eine TYPO3-Website
     mit Dev-, Staging- und Produktionsumgebung.

Claude: [calls search_services → get_service_fields → create_estimate
         → add_service × 9 → export_estimate]

─────────────────────────────────────────────
Kostenschätzung: TYPO3 Website
─────────────────────────────────────────────

Dev (g1.2 Server + 50 GB Storage)       €  118 / Monat
Staging (g1.4 Server + 100 GB Storage)  €  145 / Monat
Produktion (c1.4 Server + PostgreSQL +
            Object Storage + ALB)        €  394 / Monat
─────────────────────────────────────────────
Gesamt                                   €  657 / Monat
                                         €7.891 / Jahr

Preisquelle: STACKIT PIM API (live), 2026-06-02

→ https://calculator.stackit.cloud/?addService=servers
  &addService=postgresql-flex&addService=object-storage
  &addService=alb
─────────────────────────────────────────────
```

Other things you can ask:

- *"What STACKIT database options are available and what do they cost?"*
- *"Add a Redis cache to the production group."*
- *"Give me the annual cost breakdown for the estimate."*
- *"Compare the cost of g1.4 vs c1.4 servers for our workload."*

---

## Tools Reference

| Tool | Description | Key inputs |
|------|-------------|------------|
| `search_services` | Search for STACKIT services by name, category, or keyword | `query` (string) |
| `get_service_fields` | Get configurable fields and all pricing options for a service | `service_key` (string) |
| `create_estimate` | Create a new named estimate | `name` (string) |
| `add_service` | Add a configured service to an estimate; returns monthly cost immediately | `estimate_id`, `service_key`, `config`, `group` (optional) |
| `export_estimate` | Return full cost breakdown with group subtotals, annual total, and calculator.stackit.cloud deep link | `estimate_id` |

---

## Supported Services

| Service key | Service name | Category |
|-------------|-------------|----------|
| `server` | STACKIT Server | Compute Engine |
| `object-storage` | Object Storage | Storage |
| `block-storage` | Block Storage | Storage |
| `ske` | STACKIT Kubernetes Engine | Developer Platform |
| `database-postgres` | PostgreSQL Flex | Database |
| `database-mariadb` | MariaDB | Database |
| `database-redis` | Redis | Database |
| `load-balancer` | Application Load Balancer | Networking |
| `public-ip` | Public IP Address | Networking |

Server flavors cover all g1.x (general purpose), c1.x (compute optimized), and m1.x (memory optimized) instance types. Database services expose the top 8 plans sorted by price.

---

## Pricing Data

Prices are sourced from the same API the STACKIT online calculator uses (`pim.api.stackit.cloud/v1/skus`, region `eu01`). The server applies a three-tier strategy so estimates always work — even without network access:

```
┌─────────────────────────────────────────────┐
│ 1. Disk cache (~/.cache/stackit-mcp/)        │
│    Fresh if < 24 hours old                   │
│    source: "cache"                           │
├─────────────────────────────────────────────┤
│ 2. Live STACKIT PIM API                      │
│    pim.api.stackit.cloud/v1/skus?region=eu01 │
│    Updates cache on success                  │
│    source: "live"                            │
├─────────────────────────────────────────────┤
│ 3. Bundled prices.json (package fallback)    │
│    723 SKUs, included in npm package         │
│    Updated with every release                │
│    source: "bundle"                          │
└─────────────────────────────────────────────┘
```

Every response from every tool includes a `price_source` field (`"live"`, `"cache"`, or `"bundle"`) and a `price_date` so you always know how current the pricing is.

---

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run tests
npm test

# Refresh bundled prices.json from the STACKIT PIM API
npm run update-prices

# Run in development mode (no build step)
npm run dev
```

The test suite covers the price loader, service registry, estimate store, link builder, tool handlers, and a full end-to-end flow.

---

## License

MIT — see [LICENSE](LICENSE).
