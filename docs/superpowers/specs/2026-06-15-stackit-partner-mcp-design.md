# Design: @stackit-mcp/partner

**Date:** 2026-06-15
**Status:** Approved

## Goal

New MCP package that gives Claude access to the STACKIT Partner Portal — starting with Customer Relations (list of reseller customers). Opps/opportunities will follow once the endpoint is known.

## Architecture

New package `partner/` in the existing mono-repo, identical layout to `resources/`:

```
stackit-mcp/
└── partner/
    ├── src/
    │   ├── index.ts           # MCP server, tool registration
    │   ├── auth/
    │   │   └── token.ts       # PKCE flow (stackit-partner-portal-prod client)
    │   ├── api/
    │   │   └── client.ts      # HTTP client for cost.api.stackit.cloud
    │   └── tools/
    │       └── customers.ts   # list_customers implementation
    ├── package.json           # name: @stackit-mcp/partner
    └── tsconfig.json
```

MCP server name: `stackit-partner`
npm package name: `@stackit-mcp/partner`
bin entry: `stackit-partner`

## Auth

Same PKCE browser-login flow as `resources`, with these differences:

| | resources | partner |
|--|--|--|
| `client_id` | `stackit-cli-0000-0000-000000000001` | `stackit-partner-portal-prod` |
| scopes | `openid offline_access email` | `email openid` |
| refresh token | yes | no (partner portal doesn't issue one) |
| token cache | `~/.cache/stackit-mcp/auth.json` | `~/.cache/stackit-mcp/partner-auth.json` |
| SA key support | yes | no (partner portal is user-only) |

Same OIDC discovery endpoint: `https://accounts.stackit.cloud/.well-known/openid-configuration`

## Configuration

`STACKIT_PARTNER_ORG_ID` — required env var, the partner organization UUID. If missing, the first tool call throws a clear error: `"STACKIT_PARTNER_ORG_ID is not set. Add it to your MCP env config."` Not checked at startup so the server always starts cleanly.

## Tools

### auth_login
Opens the STACKIT browser login (PKCE). Same UX as `resources`: opens browser, saves token, returns success message.

### auth_logout
Clears the partner token cache.

### list_customers
Lists all customer organizations under the partner org, with optional cost data.

**Endpoint:** `GET https://cost.api.stackit.cloud/v3/costs/{orgId}/customers`

**Parameters (all optional):**
- `from` — start date YYYY-MM-DD (default: first day of previous month)
- `to` — end date YYYY-MM-DD (default: last day of previous month)
- `granularity` — `daily` | `monthly` (default: `monthly`)

**Returns:** Array of customers with name, ID, type, and cost totals from the API response. Raw fields are mapped to snake_case for consistency with other stackit-mcp tools.

## Error handling

- Not authenticated → clear message pointing to `auth_login`
- `STACKIT_PARTNER_ORG_ID` not set → clear message
- API 4xx/5xx → surface status code and body (same pattern as `resources`)

## Out of scope (this iteration)

- Opportunities / Opps (endpoint unknown, to be added later)
- Access management
- Invoice export
- npm publish (to be decided after first working version)
