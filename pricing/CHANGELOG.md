# Changelog

All notable changes to `@stackit-mcp/pricing` are documented here.

Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org)

---

## [0.1.0] — 2026-06-02

Initial release.

### Tools
- `search_services` — search STACKIT services by name, category, or keyword
- `get_service_fields` — inspect configurable fields and all pricing options for a service
- `create_estimate` — create a named multi-stage estimate
- `add_service` — add a configured service to an estimate (returns monthly cost immediately)
- `export_estimate` — full cost breakdown as JSON + Markdown + CSV
- `save_estimate` — write estimate to disk as `.xlsx` (default), `.csv`, and/or `.md`

### Supported services
Server, Block Storage, Object Storage, PostgreSQL Flex, MariaDB, Redis, Application Load Balancer, Public IP Address, STACKIT Kubernetes Engine

### Pricing accuracy
- Server prices include mandatory 64 GB boot volume (Premium-Capacity + Performance Class 0)
- ALB price includes mandatory 2× c2i.1 compute nodes
- Server flavors sorted current-gen first (g3i > g2i > c3i > c2i > …)
- Three-tier pricing: live STACKIT PIM API → 24h disk cache → bundled 700+ SKUs

### Excel export (.xlsx)
- Sheet "Übersicht": STACKIT-colored stage headers, subtotals, annual total, color scale on EUR column
- Sheet "Details": full service breakdown with config, per-service notes, alternating row colors
- Built with ExcelJS

### Pricing data
- Sourced from `pim.api.stackit.cloud/v1/skus?region=eu01` (same API as calculator.stackit.cloud)
- 700+ SKUs bundled as offline fallback
- Every response includes `price_source` (`live` / `cache` / `bundle`) and `price_date`
