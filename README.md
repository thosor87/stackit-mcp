# @stackit-mcp

MCP servers for STACKIT — letting Claude and other AI assistants work with STACKIT cloud services directly from the conversation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-green?style=flat-square&logo=node.js)](https://nodejs.org)

---

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [pricing/](pricing/) | Multi-stage cost estimates with live pricing and Excel export | [![npm](https://img.shields.io/npm/v/%40stackit-mcp%2Fpricing?style=flat-square)](https://www.npmjs.com/package/@stackit-mcp/pricing) |
| [resources/](resources/) | List and manage STACKIT resources with interactive browser login | [![npm](https://img.shields.io/npm/v/%40stackit-mcp%2Fresources?style=flat-square)](https://www.npmjs.com/package/@stackit-mcp/resources) |
| [partner/](partner/) | Customer cost data from the STACKIT Partner Portal (resellers only) | [![npm](https://img.shields.io/npm/v/%40stackit-mcp%2Fpartner?style=flat-square)](https://www.npmjs.com/package/@stackit-mcp/partner) |

---

## Quick start

```bash
# Pricing estimates
claude mcp add stackit-pricing -- npx -y @stackit-mcp/pricing@latest

# Resource overview (requires STACKIT login)
claude mcp add stackit-resources -- npx -y @stackit-mcp/resources@latest

# Partner Portal — customer cost data (resellers only, requires partner org ID)
claude mcp add stackit-partner -- npx -y @stackit-mcp/partner@latest
```

For `stackit-partner`, add your partner org ID to `~/.claude.json`:
```json
"stackit-partner": { "env": { "STACKIT_PARTNER_ORG_ID": "<your-org-id>" } }
```

### Example conversations

**Cost estimate with Excel export:**
> *"Erstelle eine STACKIT-Kostenkalkulation für eine TYPO3-Website mit Dev, Staging und Produktion. Speichere als Excel."*

**Multi-server production setup:**
> *"Kalkulation: Produktion mit 2× g2i.4 App-Servern, 1× m2i.4 DB-Server, PostgreSQL Flex, ALB und Object Storage."*

**Compare configurations:**
> *"Was kostet der Unterschied zwischen g2i.2 und g2i.4 für unsere Staging-Umgebung über ein Jahr?"*

---

## @stackit-mcp/pricing

Cost estimates for STACKIT cloud services — directly in Claude, Cursor, or VS Code.

[![Install in Claude Code](https://img.shields.io/badge/Claude_Code-Install-CC785C?style=flat-square&logo=anthropic&logoColor=white)](pricing/#claude-code)
[![Install in Cursor](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=stackit-pricing&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBzdGFja2l0LW1jcC9wcmljaW5nQGxhdGVzdCJdfQ==)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=stackit-pricing&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBzdGFja2l0LW1jcC9wcmljaW5nQGxhdGVzdCJdfQ==)

**Tools:** `search_services` · `get_service_fields` · `create_estimate` · `add_service` · `export_estimate` · `save_estimate`

**Supported services:** Server (g2i/g3i/c2i/m2i), Block Storage, Object Storage, PostgreSQL Flex, MariaDB, Redis, Application Load Balancer, Public IP, Kubernetes Engine

**Pricing:** Live from `pim.api.stackit.cloud` — the same API the STACKIT calculator uses. Falls back to 24h disk cache, then bundled 700+ SKUs.

**Export:** `.xlsx` with two formatted sheets and color scale, `.csv`, `.md`

→ [Full documentation](pricing/README.md)

---

## @stackit-mcp/resources

List and manage STACKIT cloud resources — servers, databases, storage, Kubernetes clusters, projects.

[![Install in Claude Code](https://img.shields.io/badge/Claude_Code-Install-CC785C?style=flat-square&logo=anthropic&logoColor=white)](resources/#claude-code)

**Tools:** `list_projects` · `set_project` · `list_servers` · `list_databases` · `list_storage` · `list_clusters` · `server_action`

**Auth:** Browser-based PKCE login via `accounts.stackit.cloud` — no credentials in config.

→ [Full documentation](resources/README.md)

---

## @stackit-mcp/partner

Query customer cost data from the STACKIT Partner Portal — for STACKIT resellers only.

**Tools:** `list_customers` · `auth_login` · `auth_logout`

**Requires:** STACKIT Partner Portal access + partner org ID in `STACKIT_PARTNER_ORG_ID` env var.

**Cost fields:** `list_eur` (gross list price), `discount_eur`, `net_eur` (what customer pays), `discount_pct` — resolved via live partnership names, no local mapping needed.

→ [Full documentation](partner/README.md)

---

## Repository structure

```
stackit-mcp/                    github.com/thosor87/stackit-mcp
├── pricing/                    @stackit-mcp/pricing
│   ├── src/
│   │   ├── tools/              MCP tool handlers
│   │   ├── pricing/            PIM API client, registry, cache
│   │   ├── calculator/         Link builder
│   │   └── estimate/           In-memory estimate store
│   ├── tests/                  32 tests (vitest)
│   ├── dist/                   Compiled output
│   └── package.json
├── partner/                    @stackit-mcp/partner
│   ├── src/
│   │   ├── auth/               PKCE login (stackit-partner-portal-prod client)
│   │   ├── api/                HTTP client for cost.api.stackit.cloud
│   │   └── tools/              list_customers
│   └── package.json
└── docs/                       GitHub Pages (calculator launcher)
```

---

## Contributing

New STACKIT service? Pricing bug? Open an issue or PR on [github.com/thosor87/stackit-mcp](https://github.com/thosor87/stackit-mcp).

Planned packages (PRs welcome):
- `@stackit-mcp/infra` — Terraform/IaC templates for STACKIT
- `@stackit-mcp/portal` — STACKIT Portal API integration

---

## License

MIT — see [LICENSE](LICENSE).
