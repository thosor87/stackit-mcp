# @stackit-mcp/resources

MCP server that lets Claude and other AI assistants list and manage STACKIT cloud resources — with interactive browser login identical to `stackit auth login`.

[![npm](https://img.shields.io/npm/v/%40stackit-mcp%2Fresources?style=flat-square)](https://www.npmjs.com/package/@stackit-mcp/resources)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-green?style=flat-square&logo=node.js)](https://nodejs.org)

---

## Features

- **Interactive browser login** — same OAuth2 PKCE flow as `stackit auth login`, browser opens automatically
- **Auto-detect STACKIT CLI session** — if you've already run `stackit auth login`, no extra login needed
- **Session default project** — set once with `set_project`, all other tools use it automatically
- **List all resource types** — servers, databases (PostgreSQL Flex, MariaDB, Redis), Object Storage, Kubernetes clusters
- **Server lifecycle** — start, stop, reboot with a confirm guard
- **Graceful degradation** — services not enabled in a project return an empty list with a note instead of an error

---

## Installation

```bash
claude mcp add stackit-resources -- npx -y @stackit-mcp/resources@latest
```

Or add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "stackit-resources": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@stackit-mcp/resources@latest"]
    }
  }
}
```

---

## Usage

```
You: Log in to STACKIT and show me all resources in my CoolAI project.

Claude: [auth_login → browser opens → list_projects → set_project → list_servers + list_databases + list_clusters + list_storage]

Projects found: Marketplace, CoolAI-dev-01, basebox-sandbox, mcp-test, ...

CoolAI-dev-01 resources:
  Servers:   3× running (g2i.2, g2i.4, m2i.2)
  Databases: 1× PostgreSQL Flex 2.4 Single
  Clusters:  1× SKE cluster (k8s 1.30)
  Storage:   2 buckets
```

---

## Tools

### `auth_login`

Log in to STACKIT. Without arguments opens an interactive browser login (PKCE OAuth2, same as `stackit auth login`). Automatically detects an existing STACKIT CLI session — if you've already logged in via CLI, no browser interaction is needed.

```
auth_login()                         # interactive browser login
auth_login({ key_path: "/path/to/sa-key.json" })  # Service Account Key
```

Token is cached in `~/.cache/stackit-mcp/auth.json` with automatic refresh.

### `auth_logout`

Clear the cached token.

### `set_project`

Set the default project for the session. All other tools use this project if no `project_id` is given.

```
set_project({ project_id: "733ab763-606a-41a4-9a86-ad4c69a6face" })
```

### `list_projects`

List all STACKIT projects accessible with the current credentials.

### `list_servers`

List servers with status, flavor, availability zone, and IPs.

```
list_servers()                            # uses session default project
list_servers({ project_id: "..." })       # explicit project
```

### `list_databases`

List all managed database instances (PostgreSQL Flex, MariaDB, Redis) in a project. Queries all three services in parallel.

### `list_clusters`

List STACKIT Kubernetes Engine (SKE) clusters with version and node pool details.

### `list_storage`

List Object Storage buckets in a project.

### `server_action`

Start, stop, or reboot a server. Requires `confirm: true` to prevent accidental actions.

```
server_action({
  server_id: "abc123",
  action: "stop",
  confirm: true
})
```

---

## Authentication

Authentication is checked in this order:

```
1. Cached token       ~/.cache/stackit-mcp/auth.json  (< 1h old)
2. STACKIT CLI        ~/.config/stackit/cli-auth-storage.txt
3. SA key env var     STACKIT_SERVICE_ACCOUNT_KEY_PATH
4. SA key file        From ~/.config/stackit/credentials.json
5. Interactive login  Browser PKCE flow (auth_login tool)
```

The interactive login uses the same OAuth2 client as the STACKIT CLI (`stackit-cli-0000-0000-000000000001`) and opens a local callback server on ports 8000–8005.

---

## Development

```bash
git clone https://github.com/thosor87/stackit-mcp
cd stackit-mcp/resources
npm install && npm run build
```

Point your MCP client at the local build:

```json
{
  "mcpServers": {
    "stackit-resources": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/stackit-mcp/resources/dist/index.js"]
    }
  }
}
```

---

## License

MIT — see [LICENSE](../LICENSE).
