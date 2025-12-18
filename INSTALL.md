# Installation Guide

## Quick Start

### 1. Build the Extension

```bash
cd terminal-hook
bun install
bun run compile
bun run package
```

This creates `terminal-hook-1.0.0.vsix`.

### 2. Install the Extension

**Via Command Palette:**
1. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P`
2. Type "Extensions: Install from VSIX"
3. Select the `.vsix` file

**Via Command Line:**
```bash
cursor --install-extension terminal-hook-1.0.0.vsix
```

### 3. Enable Proposed API (Required)

The extension uses a proposed API for real-time terminal capture. Always launch with:

```bash
cursor --enable-proposed-api rodgomesc.terminal-hook
```

**Recommended:** Add to your `~/.zshrc` or `~/.bashrc`:

```bash
alias cursor='cursor --enable-proposed-api rodgomesc.terminal-hook'
```

### 4. Restart Cursor

The extension **automatically registers** itself in `~/.cursor/mcp.json` on first activation. Just restart Cursor to pick up the MCP config.

### 5. Test

1. Open a terminal in Cursor
2. Run some commands
3. Ask Claude: "What's in my terminal?"

## Troubleshooting

### MCP can't connect

1. Make sure Cursor is open with the extension active
2. Check port 9876: `lsof -i :9876`
3. Restart Cursor

## Uninstall

```bash
cursor --uninstall-extension rodgomesc.terminal-hook
```
