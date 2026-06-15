# @stackit-mcp/partner

MCP server for the STACKIT Partner Portal — lets Claude query customer relations and cost data directly from the conversation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-green?style=flat-square&logo=node.js)](https://nodejs.org)

> **Local only** — not published to npm. Intended for internal use by STACKIT resellers and partners.

---

## Features

- **Customer list with costs** — gross, discount, and net per customer for any date range
- **Project breakdown** — all projects per customer, sorted by spend
- **Live partnership names** — resolved from the STACKIT Partner API, no manual mapping
- **Browser-based login** — PKCE OAuth flow, no credentials in code or config files
- **Token persistence** — refresh token keeps sessions alive across restarts

---

## Installation

### Prerequisites

- Node.js ≥ 18
- A STACKIT Partner Portal account with reseller access
- Your partner organization ID (visible in the Partner Portal URL)

### Build

```bash
cd partner
npm install
npm run build
```

### Configure Claude Code

Add to `~/.claude.json` under `mcpServers`:

```json
"stackit-partner": {
  "type": "stdio",
  "command": "node",
  "args": ["/absolute/path/to/partner/dist/index.js"],
  "env": {
    "STACKIT_PARTNER_ORG_ID": "<your-partner-org-id>"
  }
}
```

The org ID is read from the environment at runtime — never stored in the repository.

---

## Authentication

The server uses the public STACKIT CLI OAuth client with PKCE — the same flow as the STACKIT CLI itself. No client secret required.

**First use:**

```
auth_login
```

A browser window opens to `accounts.stackit.cloud`. After login, the token is cached at `~/.cache/stackit-mcp/partner-auth.json` (mode 600). A refresh token keeps the session alive without repeated logins.

**Tools:**

| Tool | Description |
|---|---|
| `auth_login` | Open browser login, cache the token |
| `auth_logout` | Clear the cached token |
| `auth_set_token` | Manually set a Bearer token (fallback) |

---

## Tools

### `list_customers`

Returns all customer organizations with cost data for a given period.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `from` | `string` | First day of previous month | Start date `YYYY-MM-DD` |
| `to` | `string` | Last day of previous month | End date `YYYY-MM-DD` |
| `granularity` | `daily` \| `monthly` | `monthly` | Cost granularity |

**Response per customer:**

```json
{
  "customer_account_id": "uuid",
  "name": "Organization Name",
  "partnership_status": "ACTIVE",
  "gross_eur": 12345.67,
  "discount_eur": 7654.32,
  "net_eur": 4691.35,
  "project_count": 8,
  "top_project": "project-name-prod",
  "projects": ["project-name-prod", "project-name-dev", "..."]
}
```

Customers are sorted by `gross_eur` descending. Names are resolved live from the STACKIT Partner API — no local mapping file needed.

---

## APIs used

| API | Endpoint | Purpose |
|---|---|---|
| `cost.api.stackit.cloud` | `GET /v3/costs/{orgId}/customers` | Project-level cost data |
| `partner.api.stackit.cloud` | `GET /v1/partners/{orgId}/partnerships` | Customer names and partnership status |
| `accounts.stackit.cloud` | OIDC / token endpoint | Authentication |

Token cache: `~/.cache/stackit-mcp/partner-auth.json`

---

## Development

```bash
npm run build   # compile TypeScript
npm test        # run vitest tests
```

---

## License

MIT — see [LICENSE](LICENSE).
