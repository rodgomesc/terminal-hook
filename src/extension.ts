import * as vscode from 'vscode';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TerminalBufferService } from './services/TerminalBufferService';
import { MCPServer } from './services/MCPServer';

let terminalService: TerminalBufferService;
let mcpServer: MCPServer;
let server: net.Server | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Terminal Hook extension is now active');

  terminalService = new TerminalBufferService(10000);
  terminalService.initialize(context);
  mcpServer = new MCPServer(terminalService);
  startMCPServer(context);
  registerMCPConfig(context);
  context.subscriptions.push(
    vscode.commands.registerCommand('terminal-hook.getTerminalOutput', async () => {
      const terminals = terminalService.getAllTerminals();
      
      if (terminals.length === 0) {
        vscode.window.showInformationMessage('No terminals found');
        return;
      }

      const items = terminals.map(t => ({
        label: t.name || '(unnamed)',
        description: `${t.buffer.length} lines`,
        terminal: t,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a terminal to view output',
      });

      if (selected) {
        const buffer = terminalService.getTerminalBuffer(selected.terminal.id);
        if (buffer) {
          const doc = await vscode.workspace.openTextDocument({
            content: buffer,
            language: 'log',
          });
          await vscode.window.showTextDocument(doc);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('terminal-hook.listTerminals', () => {
      const terminals = terminalService.getAllTerminals();
      
      if (terminals.length === 0) {
        vscode.window.showInformationMessage('No terminals found');
        return;
      }

      const message = terminals
        .map(t => `${t.name || '(unnamed)'} (${t.buffer.length} lines)`)
        .join('\n');
      
      vscode.window.showInformationMessage(`Active Terminals:\n${message}`);
    })
  );

  context.subscriptions.push({
    dispose: () => {
      terminalService.dispose();
      if (server) {
        server.close();
      }
    },
  });
}

function startMCPServer(context: vscode.ExtensionContext) {
  const port = 9876;
  
  server = net.createServer((socket) => {
    console.log('MCP client connected');

    socket.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const request = JSON.parse(line);
          const response = mcpServer.handleRequest(request);
          
          if (response) {
            socket.write(JSON.stringify(response) + '\n');
          }
        } catch (error: any) {
          console.error('Error handling MCP request:', error);
          socket.write(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: `Parse error: ${error.message}`,
            },
          }) + '\n');
        }
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    socket.on('close', () => {
      console.log('MCP client disconnected');
    });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Terminal Hook MCP server listening on port ${port}`);
    vscode.window.showInformationMessage(`Terminal Hook running on port ${port}`);
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
    vscode.window.showErrorMessage(`Failed to start MCP server: ${error.message}`);
  });
}

export function deactivate() {
  if (server) {
    server.close();
  }
}

async function registerMCPConfig(context: vscode.ExtensionContext) {
  const mcpConfigPath = path.join(os.homedir(), '.cursor', 'mcp.json');
  const mcpServerPath = path.join(context.extensionPath, 'out', 'mcp-server.cjs');
  
  try {
    let config: Record<string, any> = {};
    
    if (fs.existsSync(mcpConfigPath)) {
      const content = fs.readFileSync(mcpConfigPath, 'utf-8');
      config = JSON.parse(content);
    }
    
    const mcpServers: Record<string, any> = config.mcpServers || {};
    const existing = mcpServers['terminal-hook'];
    
    if (existing?.args?.[0] === mcpServerPath) {
      console.log('MCP config already up to date');
      return;
    }
    
    mcpServers['terminal-hook'] = {
      command: 'node',
      args: [mcpServerPath]
    };
    config.mcpServers = mcpServers;
    
    const cursorDir = path.dirname(mcpConfigPath);
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }
    
    fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
    
    if (existing) {
      vscode.window.showInformationMessage('Terminal Hook: MCP config updated (path changed)');
    } else {
      vscode.window.showInformationMessage('Terminal Hook: MCP server registered in ~/.cursor/mcp.json');
    }
  } catch (error: any) {
    console.error('Failed to register MCP config:', error);
    vscode.window.showWarningMessage(`Terminal Hook: Could not auto-register MCP config: ${error.message}`);
  }
}
