# @stackit-mcp

MCP servers for STACKIT — letting Claude and other AI assistants work with STACKIT cloud services.

---

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [pricing/](pricing/) | Create cost estimates from live STACKIT pricing | [![npm](https://img.shields.io/npm/v/%40stackit-mcp%2Fpricing?style=flat-square)](https://www.npmjs.com/package/@stackit-mcp/pricing) |

---

## Quick start

```bash
# Add the pricing MCP to Claude Code
claude mcp add stackit-pricing -- npx -y @stackit-mcp/pricing@latest
```

Or add it manually to `~/.claude.json`:

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

Then ask Claude: *"Erstelle eine STACKIT-Kostenkalkulation für eine TYPO3-Website mit Dev, Staging und Produktion."*

---

## Repository structure

```
@stackit-mcp/
└── pricing/    # @stackit-mcp/pricing — STACKIT cost estimates
```

---

## License

MIT
