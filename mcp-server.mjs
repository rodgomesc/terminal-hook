#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as net from 'net';
import { z } from 'zod';

const EXTENSION_PORT = parseInt(process.env.VSCODE_TERMINAL_MCP_PORT || '9876', 10);

async function sendToExtension(request) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port: EXTENSION_PORT, host: '127.0.0.1' }, () => {
      socket.write(JSON.stringify(request) + '\n');
    });

    let data = '';
    
    socket.on('data', (chunk) => {
      data += chunk.toString();
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            socket.end();
            resolve(response);
            return;
          } catch {}
        }
      }
    });

    socket.on('error', (err) => {
      reject(new Error(`Failed to connect to VSCode extension: ${err.message}. Make sure the extension is running.`));
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Connection to VSCode extension timed out'));
    });

    socket.setTimeout(5000);
  });
}

async function callExtensionTool(toolName, args) {
  const request = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const response = await sendToExtension(request);

  if (response.error) {
    throw new Error(response.error.message);
  }

  if (response.result?.content?.[0]?.text) {
    return JSON.parse(response.result.content[0].text);
  }
  
  return response.result;
}

async function main() {
  const server = new McpServer({
    name: 'terminal-hook',
    version: '1.0.0',
  });

  server.tool(
    'list_terminals',
    'List all active VSCode terminals with their metadata',
    {},
    async () => {
      try {
        const result = await callExtensionTool('list_terminals', {});
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Make sure the Terminal Hook extension is running in VSCode/Cursor',
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_terminal_output',
    'Get recent output from a VSCode terminal buffer. Use list_terminals first to see available terminals.',
    {
      terminal_name: z.string().describe('Terminal name or ID (e.g., "zsh", "bash", "node"). Use list_terminals to see available options.'),
      lines: z.number().optional().default(100).describe('Number of lines to return (default: 100)'),
    },
    async (args) => {
      try {
        const result = await callExtensionTool('get_terminal_output', args);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              hint: 'Make sure the Terminal Hook extension is running in VSCode/Cursor',
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Terminal Hook MCP server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
