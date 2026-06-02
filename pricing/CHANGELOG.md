# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-02

### Added

- Initial release of `stackit-mcp` — a Model Context Protocol server for STACKIT cloud pricing estimates
- **5 MCP tools** over stdio transport:
  - `search_services` — find STACKIT services by name, category, or keyword
  - `get_service_fields` — inspect configurable fields and pricing options for a service
  - `create_estimate` — create a named estimate
  - `add_service` — add a configured service to an estimate with immediate monthly cost calculation
  - `export_estimate` — full cost breakdown with group subtotals, annual total, and calculator deep link
- **9 supported STACKIT services** (region eu01):
  - Server (all g1.x, c1.x, m1.x and additional flavor families)
  - Object Storage (S3-compatible, priced per GB-month)
  - Block Storage (persistent volumes, priced per GB-month)
  - SKE — STACKIT Kubernetes Engine (cluster management fee)
  - PostgreSQL Flex (top 8 plans by price)
  - MariaDB (top 8 plans by price)
  - Redis (top 8 plans by price)
  - Application Load Balancer
  - Public IP Address
- **Three-tier pricing strategy** with transparent `price_source` field in every response:
  - Live STACKIT PIM API (`pim.api.stackit.cloud/v1/skus?region=eu01`) — same source as the official STACKIT calculator
  - 24-hour disk cache at `~/.cache/stackit-mcp/prices.json`
  - Bundled fallback `prices.json` included in the npm package (723 SKUs, last updated 2026-06-02)
- **`calculator.stackit.cloud` deep link generation** in `export_estimate` — pre-selects all service types from the estimate for interactive configuration in the browser
- **Group support** in estimates — services can be assigned to named groups (e.g. Dev, Staging, Production) with per-group subtotals in the export
- **`npm run update-prices`** script to refresh the bundled `prices.json` from the live STACKIT PIM API
- Full test suite covering price loader, service registry, estimate store, link builder, tool handlers, and an end-to-end create → add → export flow
- `npx -y stackit-mcp@latest` distribution — no installation required for Claude Code, Cursor, VS Code and other MCP clients

[Unreleased]: https://github.com/thosor87/stackit-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/thosor87/stackit-mcp/releases/tag/v0.1.0
