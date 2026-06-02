# STACKIT MCP Server — Design Spec

**Date:** 2026-06-02  
**Repo:** github.com/thosor87/stackit-mcp  
**Status:** Approved

---

## 1. Ziel

Ein MCP Server für STACKIT, der Claude erlaubt, Kostenkalkulationen für STACKIT Cloud Services zu erstellen — analog zum `sample-aws-pricing-calculator-mcp`. Ausgabe ist eine lokale Preisaufschlüsselung plus ein Link zu `calculator.stackit.cloud`.

---

## 2. Stack & Transport

- **Sprache:** TypeScript (Node.js v18+)
- **Transport:** stdio — Server startet on-demand durch Claude, kein Daemon
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Distribution:** npm-Paket `stackit-mcp`, aufrufbar via `npx -y stackit-mcp@latest`
- **Referenz-Implementierung:** `btc-decidalo-mcp` (gleiche Projektstruktur)

---

## 3. Projektstruktur

```
stackit-mcp/
├── src/
│   ├── index.ts                  # MCP Entry Point (stdio server)
│   ├── tools/
│   │   ├── create-estimate.ts
│   │   ├── add-service.ts
│   │   ├── search-services.ts
│   │   ├── get-service-fields.ts
│   │   └── export-estimate.ts
│   ├── pricing/
│   │   ├── loader.ts             # Scrape → Cache → Fallback
│   │   ├── scraper.ts            # HTML-Parser für stackit.cloud/preise
│   │   └── prices.json           # Bundled Fallback-Preise
│   ├── estimate/
│   │   └── store.ts              # In-memory Estimate-Store (Map<id, Estimate>)
│   └── calculator/
│       └── link-builder.ts       # calculator.stackit.cloud URL-Generator
├── scripts/
│   └── update-prices.ts          # Manuelles Preisupdate vor Release
├── tests/
│   ├── loader.test.ts
│   ├── scraper.test.ts
│   ├── tools.test.ts
│   └── e2e.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 4. Die 5 MCP-Tools

### `search_services`
Suche nach verfügbaren STACKIT Services.

```
Input:  query: string
Output: Array<{ service_key, name, category, description }>
```

### `get_service_fields`
Konfigurierbare Felder eines Services mit Optionen (z.B. Flavors).

```
Input:  service_key: string
Output: Array<{ id, type, label, options?, unit? }>
```

### `create_estimate`
Neue Kalkulation anlegen.

```
Input:  name?: string
Output: { estimate_id: string, name: string }
```

### `add_service`
Service zur Kalkulation hinzufügen und Monatspreis berechnen.

```
Input:  estimate_id, service_key, group?, config: Record<string, unknown>
Output: { service, group, monthly_cost_eur, price_source, price_date }
```

### `export_estimate`
Zusammenfassung + calculator.stackit.cloud Link.

```
Input:  estimate_id
Output: {
  groups: Array<{ name, services, subtotal_month }>,
  total_month_eur,
  total_year_eur,
  calculator_url,         # calculator.stackit.cloud mit Parametern
  price_source,           # "live" | "cache" | "bundle"
  price_date
}
```

---

## 5. Abgedeckte Services (v1)

| Service        | service_key        | Preisseite                          |
|----------------|--------------------|-------------------------------------|
| Server/Compute | `server`           | .../compute/server                  |
| Object Storage | `object-storage`   | .../object-storage                  |
| SKE (K8s)      | `ske`              | .../kubernetes-engine               |
| Datenbanken    | `database`         | .../paas/stackit-database           |
| Load Balancer  | `load-balancer`    | .../netzwerk                        |
| Public IP      | `public-ip`        | .../netzwerk                        |

---

## 6. Preisdaten & Hybrid-Loader

### Ladereihenfolge

```
1. Cache prüfen  (~/.cache/stackit-mcp/prices.json)
      → Alter < 24h?  → verwenden
2. Scrapen       (stackit.cloud Preisseiten via fetch + node-html-parser)
      → OK?           → Cache schreiben + verwenden
3. Fallback      (eingebettetes src/pricing/prices.json)
      → immer         → verwenden, Nutzer wird informiert
```

### prices.json Format

```json
{
  "meta": {
    "source": "bundle",
    "date": "2026-06-02",
    "version": "1.0.0"
  },
  "services": {
    "server": {
      "name": "STACKIT Server",
      "category": "Compute",
      "fields": [
        { "id": "flavor", "type": "dropdown", "label": "Flavor",
          "options": [
            { "id": "g1.1", "label": "g1.1 (1 vCPU, 2 GB RAM)", "price_month": 0.00 },
            { "id": "g1.2", "label": "g1.2 (2 vCPU, 4 GB RAM)", "price_month": 0.00 },
            { "id": "g1.4", "label": "g1.4 (4 vCPU, 8 GB RAM)", "price_month": 0.00 }
          ]
        },
        { "id": "quantity", "type": "number", "label": "Anzahl", "default": 1 }
      ]
    },
    "object-storage": {
      "name": "Object Storage",
      "category": "Storage",
      "fields": [
        { "id": "storage_gb", "type": "number", "label": "Speicher (GB)", "price_per_unit_month": 0.00 }
      ]
    }
  }
}
```

### Scraper

- Library: `node-html-parser` (leichtgewichtig, kein Playwright)
- Jede Preisseite hat eine eigene Parser-Funktion in `scraper.ts`
- Bei Parse-Fehler → Fallback für diesen Service, nicht Gesamtabbruch
- Integration Test (`TEST_LIVE=1`) validiert Scraper gegen echte Seiten

---

## 7. calculator.stackit.cloud Link

Der STACKIT Calculator unterstützt `?addService=<key>` URL-Parameter. `export_estimate` baut einen Link mit allen Services vor — der Nutzer landet direkt auf einer vorausgefüllten Kalkulation.

Basis-Link (bekannt, funktioniert):
```
https://calculator.stackit.cloud/?addService=server&addService=object-storage
```

**Implementierungsaufgabe:** Während der Implementierung wird `calculator.stackit.cloud` analysiert (Network-Tab), um zu prüfen ob tiefere Konfigurationsparameter (Flavor, Menge etc.) als Query-Parameter übergeben werden können. Falls ja → vollständige Deep-Links. Falls nein → Link mit vorausgewählten Services + lokale Preisaufschlüsselung in der MCP-Antwort.

---

## 8. Testing

| Ebene        | Tool    | Was                                              | Wann         |
|--------------|---------|--------------------------------------------------|--------------|
| Unit         | vitest  | Loader-Logik, Preisberechnung, Link-Builder      | `npm test`   |
| Integration  | vitest  | Live-Scraping (echte stackit.cloud Seiten)       | `TEST_LIVE=1 npm test` |
| E2E          | vitest  | Vollständiger Tool-Durchlauf (create→add→export) | `npm test`   |

---

## 9. Lokale Registrierung

**Entwicklung** (lokaler Build):
```json
"stackit-mcp": {
  "type": "stdio",
  "command": "node",
  "args": ["/Users/thsoring/Library/CloudStorage/OneDrive-BTCAG/CCode/stackit-mcp/dist/index.js"]
}
```

**Produktiv** (nach npm-Publish):
```json
"stackit-mcp": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "stackit-mcp@latest"]
}
```

---

## 10. Update-Workflow (Preise)

Vor jedem npm-Release:
```bash
npm run update-prices   # → scripts/update-prices.ts scrapt alle Seiten
                        # → schreibt src/pricing/prices.json neu
npm run build
npm publish
```
