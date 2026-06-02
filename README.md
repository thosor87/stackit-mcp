# @stackit-mcp

MCP servers for STACKIT — letting Claude and other AI assistants work with STACKIT cloud services.

---

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [pricing/](pricing/) | Multi-stage cost estimates with live pricing and Excel export | [![npm](https://img.shields.io/npm/v/%40stackit-mcp%2Fpricing?style=flat-square)](https://www.npmjs.com/package/@stackit-mcp/pricing) |

---

## Quick start

```bash
claude mcp add stackit-pricing -- npx -y @stackit-mcp/pricing@latest
```

Then ask Claude:

> *"Erstelle eine STACKIT-Kostenkalkulation für eine TYPO3-Website mit Dev, Staging und Produktion. Speichere als Excel."*

---

## Repository structure

```
@stackit-mcp/
└── pricing/    @stackit-mcp/pricing — STACKIT cost estimates
```

---

## License

MIT
