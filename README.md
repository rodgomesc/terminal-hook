# Terminal Hook

A VSCode/Cursor extension that captures terminal output in real-time and exposes it via MCP (Model Context Protocol) for AI assistants.

## Features

- **Real-time Capture** - Captures all terminal output as it happens
- **Clean Output** - Automatically strips ANSI codes and shell noise
- **MCP Integration** - Exposes terminal data to AI assistants like Claude

## Installation

### 1. Build & Install

```bash
bun install
bun run compile
bun run package
```

Install the generated `.vsix` file via Command Palette → "Extensions: Install from VSIX"

### 2. Launch with Proposed API

This extension requires a proposed API for real-time capture. Launch with:

```bash
# Cursor
cursor --enable-proposed-api rodgomesc.terminal-hook

# VSCode
code --enable-proposed-api rodgomesc.terminal-hook
```

**Tip:** Add an alias to your shell config:

```bash
alias cursor='cursor --enable-proposed-api rodgomesc.terminal-hook'
```

### 3. Configure MCP Client

Add to your MCP config (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "terminal-hook": {
      "command": "node",
      "args": ["/path/to/terminal-hook/mcp-server.mjs"]
    }
  }
}
```

## MCP Tools

### `list_terminals`

List all active terminals with metadata.

```json
{
  "success": true,
  "count": 2,
  "terminals": [
    {
      "id": "terminal-0-zsh",
      "name": "zsh",
      "processId": 1234,
      "bufferLines": 150,
      "lastActivity": "2024-12-18T10:30:00.000Z"
    }
  ]
}
```

### `get_terminal_output`

Get output from a specific terminal.

**Parameters:**
- `terminal_name` (required): Terminal name or ID
- `lines` (optional): Number of lines to return (default: 100)

```json
{
  "success": true,
  "terminal": "zsh",
  "output": "$ npm start\nServer running on port 3000\n...",
  "lines_returned": 50
}
```

## Troubleshooting

### No output captured

Make sure you launched with the proposed API flag:

```bash
cursor --enable-proposed-api rodgomesc.terminal-hook
```

Check Output panel (View → Output → Terminal Hook) for:
- `"Using onDidWriteTerminalData"` = ✅ Working
- `"onDidWriteTerminalData not available"` = ❌ Need the flag

### Connection refused

The extension runs a TCP server on port 9876. Make sure:
1. VSCode/Cursor is open with the extension active
2. No firewall blocking localhost:9876

## Development

```bash
bun install
bun run compile
bun test
```

## License

MIT
