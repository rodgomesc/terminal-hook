# Terminal Hook

A VSCode/Cursor extension that captures terminal output in real-time and exposes it via MCP (Model Context Protocol) for AI assistants.

## Why another extension?

copy-pasting terminal output and manually referencing it in every chat is so meehhh. When AI assistants can proactively read your terminal — checking errors, logs, and command output without you having to break the execution to ask for more info, this extension solves that! Other MCP tools can also tap into terminal data for automation

## How It Works

```
┌─────────────────┐     stdio      ┌─────────────────┐     TCP      ┌─────────────────┐
│  Cursor/Claude  │◄──────────────►│  mcp-server.mjs │◄────────────►│ VSCode Extension│
│   (MCP Client)  │                │  (MCP Server)   │   port 9876  │ (Terminal Data) │
└─────────────────┘                └─────────────────┘              └─────────────────┘
```

1. **VSCode Extension** captures terminal output via `onDidWriteTerminalData` API
2. **MCP Server** (`mcp-server.mjs`) communicates with Cursor via stdio
3. **TCP Bridge** connects the MCP server to the extension on port 9876

## Features

- **Real-time Capture** - Captures all terminal output as it happens
- **Clean Output** - Automatically strips ANSI codes and shell noise
- **MCP Integration** - Exposes terminal data to AI assistants like Claude

## Installation

See [INSTALL.md](./INSTALL.md) for setup instructions.

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

## Development

```bash
bun install
bun run compile
bun test
```

## License

MIT
