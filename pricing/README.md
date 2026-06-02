# @stackit-mcp/pricing

MCP server that lets Claude and other AI assistants create multi-stage cost estimates for STACKIT cloud services — with live pricing, Excel export, and formatted summaries.

[![Install in Claude Code](https://img.shields.io/badge/Claude_Code-Install-CC785C?style=flat-square&logo=anthropic&logoColor=white)](#claude-code)
[![Install in Cursor](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=stackit-pricing&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBzdGFja2l0LW1jcC9wcmljaW5nQGxhdGVzdCJdfQ==)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=stackit-pricing&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBzdGFja2l0LW1jcC9wcmljaW5nQGxhdGVzdCJdfQ==)
[![npm](https://img.shields.io/npm/v/%40stackit-mcp%2Fpricing?style=flat-square)](https://www.npmjs.com/package/@stackit-mcp/pricing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-green?style=flat-square&logo=node.js)](https://nodejs.org)

---

## Features

- **Live STACKIT pricing** — pulls directly from the same API the STACKIT calculator uses (`pim.api.stackit.cloud`)
- **Multi-stage estimates** — Dev / Staging / Production with separate configs, subtotals and annual totals
- **Multiple servers per stage** — e.g. 2× app servers + 1× DB server in Production
- **Accurate bundled costs** — server price includes 64 GB boot volume; ALB includes mandatory 2× c2i.1 compute nodes
- **Excel export (.xlsx)** — formatted with STACKIT colors, color scale visualization, two sheets (Übersicht + Details)
- **CSV and Markdown export** — for docs, spreadsheets, or copy-paste into proposals
- **Three-tier pricing fallback** — live API → 24h disk cache → bundled 700+ SKUs (estimates always work offline)
- **Price source transparency** — every response reports whether pricing is `live`, `cache`, or `bundle`

---

## Installation

### Claude Code

```bash
claude mcp add stackit-pricing -- npx -y @stackit-mcp/pricing@latest
```

Or add to `~/.claude.json` manually:

```json
{
  "mcpServers": {
    "stackit-pricing": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@stackit-mcp/pricing@latest"]
    }
  }
}
```

### Cursor

```json
{
  "mcpServers": {
    "stackit-pricing": {
      "command": "npx",
      "args": ["-y", "@stackit-mcp/pricing@latest"]
    }
  }
}
```

### VS Code

```json
{
  "servers": {
    "stackit-pricing": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@stackit-mcp/pricing@latest"]
    }
  }
}
```

---

## Example

```
You: Erstelle eine STACKIT-Kostenkalkulation für eine TYPO3-Website
     mit Dev-, Staging- und Produktionsumgebung. Speichere als Excel.

Claude: [search_services → get_service_fields → create_estimate
         → add_service × 9 → save_estimate]

────────────────────────────────────────────────────
  Dev
    STACKIT Server · g2i.1                   € 42,78
    Block Storage · 50 GB                     € 3,27
  Subtotal Dev                               € 46,05

  Staging
    STACKIT Server · g2i.2                   € 79,60
    Block Storage · 100 GB                    € 6,53
  Subtotal Staging                           € 86,13

  Produktion
    STACKIT Server · g2i.4                  € 153,25
    PostgreSQL Flex · 2.4 Single             € 90,71
    Object Storage · 200 GB                   € 5,32
    Application Load Balancer                € 50,09
    Public IP Address                         € 2,92
  Subtotal Produktion                       € 302,29

────────────────────────────────────────────────────
  Gesamt / Monat                            € 434,47
  Gesamt / Jahr                           € 5.213,64
────────────────────────────────────────────────────

Saved to ~/Downloads/TYPO3_Website.xlsx
```

---

## Tools

### `search_services`

Search available STACKIT services by name, category, or keyword.

```
Input:  { query: "database" }
Output: list of matching services with service_key, name, category, description
```

### `get_service_fields`

Get configurable fields and all pricing options for a service.

```
Input:  { service_key: "server" }
Output: fields with dropdown options (flavors with vCPU/RAM/price),
        number fields (storage_gb, quantity), current prices
```

### `create_estimate`

Create a new named estimate. Returns an `estimate_id` used by subsequent calls.

```
Input:  { name: "TYPO3 Production" }
Output: { estimate_id: "...", name: "TYPO3 Production" }
```

### `add_service`

Add a configured service to an estimate. Returns the monthly cost immediately.

```
Input:  {
  estimate_id: "...",
  service_key: "server",
  group: "Produktion",
  config: { flavor: "g2i.4", quantity: 1 }
}
Output: { monthly_cost_eur: 153.25, price_source: "live", price_date: "2026-06-02" }
```

Multiple servers per stage, different flavors:

```
add_service(server, g2i.2, quantity: 2, group: "Produktion")  → 2× app servers
add_service(server, m2i.4, quantity: 1, group: "Produktion")  → 1× memory-optimized DB host
```

### `export_estimate`

Return the full cost breakdown as structured JSON, Markdown, and CSV.

```
Output: {
  groups: [{ name, services, subtotal_month_eur }],
  total_month_eur: 434.47,
  total_year_eur: 5213.64,
  markdown: "# TYPO3 Website\n...",
  csv: "\"TYPO3 Website\"\n...",
  price_source: "live",
  price_date: "2026-06-02"
}
```

### `save_estimate`

Write the estimate to disk. Default format: Excel (`.xlsx`).

```
Input:  {
  estimate_id: "...",
  directory: "~/Downloads",   // optional, default: ~/Downloads
  formats: ["xlsx", "csv", "md"]  // optional, default: ["xlsx"]
}
Output: { saved: ["/Users/.../TYPO3_Website.xlsx", ...], total_month_eur: 434.47 }
```

The Excel file contains:
- **Sheet "Übersicht"**: Stage headers in STACKIT teal, service rows, subtotals, annual total, color scale on the EUR column proportional to cost
- **Sheet "Details"**: Full breakdown with configuration details, per-service notes (e.g. "inkl. 64 GB Boot-Volume")

---

## Supported Services

| `service_key` | Name | Category | Notes |
|---|---|---|---|
| `server` | STACKIT Server | Compute | g2i/g3i/c2i/m2i/... flavors; **price includes 64 GB boot volume** |
| `block-storage` | Block Storage | Storage | Premium-Capacity NVMe, priced per GB/month |
| `object-storage` | Object Storage | Storage | S3-compatible, pay-per-GB |
| `database-postgres` | PostgreSQL Flex | Database | Single and Replica plans |
| `database-mariadb` | MariaDB | Database | Managed |
| `database-redis` | Redis | Database | Managed in-memory cache |
| `load-balancer` | Application Load Balancer | Networking | **Price includes mandatory 2× c2i.1 compute nodes** |
| `public-ip` | Public IP Address | Networking | Floating IPv4 |
| `ske` | STACKIT Kubernetes Engine | Platform | Priced per cluster/month |

Server flavors available (sorted current-gen first): `g3i.x`, `g2i.x`, `c3i.x`, `c2i.x`, `m3i.x`, `m2i.x`, and legacy `g1.x`, `c1.x`, `m1.x`.

---

## Pricing Data

Prices are sourced from the same API the STACKIT online calculator uses (`pim.api.stackit.cloud/v1/skus`, region `eu01`).

```
┌─────────────────────────────────────────────┐
│ 1. Live STACKIT PIM API                      │
│    pim.api.stackit.cloud/v1/skus?region=eu01 │
│    source: "live"                            │
├─────────────────────────────────────────────┤
│ 2. Disk cache (~/.cache/stackit-mcp/)        │
│    Valid for 24 hours                        │
│    source: "cache"                           │
├─────────────────────────────────────────────┤
│ 3. Bundled prices.json (offline fallback)    │
│    700+ SKUs, updated with each release      │
│    source: "bundle"                          │
└─────────────────────────────────────────────┘
```

Every tool response includes `price_source` and `price_date` so you always know how current the data is.

**Pricing notes:**
- Server prices include the mandatory 64 GB boot volume (Premium-Capacity + Performance Class 0)
- ALB prices include 2× `c2i.1` compute nodes that STACKIT provisions automatically
- All prices are net list prices excluding VAT
- PostgreSQL Flex bundles include storage and backup storage

---

## Development

```bash
git clone https://github.com/thosor87/stackit-mcp
cd stackit-mcp/pricing
npm install && npm run build
```

```bash
npm test               # run test suite (32 tests)
npm run update-prices  # refresh bundled prices.json from live API
npm run dev            # run server directly via tsx (no build step)
```

Point your MCP client at the local build:

```json
{
  "mcpServers": {
    "stackit-pricing": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/stackit-mcp/pricing/dist/index.js"]
    }
  }
}
```

---

## License

MIT — see [LICENSE](LICENSE).
