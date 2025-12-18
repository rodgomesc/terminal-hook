import * as vscode from 'vscode';
import { TerminalBufferService } from './TerminalBufferService';

export interface MCPRequest {
  jsonrpc: string;
  id?: number | string;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id?: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class MCPServer {
  private static readonly SERVER_NAME = 'terminal-hook';
  private static readonly SERVER_VERSION = '1.0.0';
  private static readonly PROTOCOL_VERSION = '2024-11-05';

  private initialized = false;

  constructor(private terminalService: TerminalBufferService) {}

  public handleRequest(request: MCPRequest): MCPResponse | null {
    const { method, params, id } = request;

    if (id === undefined) {
      this.handleNotification(method, params);
      return null;
    }

    switch (method) {
      case 'initialize':
        return this.handleInitialize(id);
      
      case 'ping':
        return this.createResponse(id, {});
      
      case 'tools/list':
        return this.handleToolsList(id);
      
      case 'tools/call':
        return this.handleToolsCall(id, params);
      
      case 'resources/list':
        return this.createResponse(id, { resources: [] });
      
      case 'prompts/list':
        return this.createResponse(id, { prompts: [] });
      
      default:
        return this.createErrorResponse(id, -32601, `Method not found: ${method}`);
    }
  }

  private handleNotification(method: string, params?: any): void {
    if (method === 'notifications/initialized') {
      this.initialized = true;
    }
  }

  private handleInitialize(id: number | string): MCPResponse {
    return this.createResponse(id, {
      protocolVersion: MCPServer.PROTOCOL_VERSION,
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: MCPServer.SERVER_NAME,
        version: MCPServer.SERVER_VERSION,
      },
    });
  }

  private handleToolsList(id: number | string): MCPResponse {
    return this.createResponse(id, {
      tools: [
        {
          name: 'list_terminals',
          description: 'List all active VSCode terminals with their metadata (name, process ID, buffer size, activity).',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_terminal_output',
          description: 'Get recent output from a VSCode terminal buffer. Use list_terminals first to see available terminals.',
          inputSchema: {
            type: 'object',
            properties: {
              terminal_name: {
                type: 'string',
                description: 'Terminal name or ID (e.g., "zsh", "bash", "node"). Use list_terminals to see available options.',
              },
              lines: {
                type: 'number',
                description: 'Number of lines to return (default: 100)',
                default: 100,
              },
            },
            required: ['terminal_name'],
          },
        },
      ],
    });
  }

  private handleToolsCall(id: number | string, params: any): MCPResponse {
    const { name, arguments: args } = params;

    try {
      let result: any;

      switch (name) {
        case 'list_terminals':
          result = this.listTerminals();
          break;
        
        case 'get_terminal_output':
          result = this.getTerminalOutput(args);
          break;
        
        default:
          return this.createErrorResponse(id, -32601, `Unknown tool: ${name}`);
      }

      return this.createResponse(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      });
    } catch (error: any) {
      return this.createErrorResponse(id, -32603, `Tool execution error: ${error.message}`);
    }
  }

  private listTerminals(): any {
    const terminals = this.terminalService.getAllTerminals();
    
    return {
      success: true,
      count: terminals.length,
      terminals: terminals.map(t => ({
        id: t.id,
        name: t.name || '(unnamed)',
        processId: t.processId,
        bufferLines: t.buffer.length,
        lastActivity: t.lastActivity.toISOString(),
      })),
    };
  }

  private getTerminalOutput(args: any): any {
    const { terminal_name, lines = 100 } = args;

    if (!terminal_name) {
      return {
        success: false,
        error: 'terminal_name is required. Use list_terminals to see available terminals.',
      };
    }

    const terminal = this.terminalService.getTerminal(terminal_name);
    
    if (!terminal) {
      const available = this.terminalService.getAllTerminals();
      return {
        success: false,
        error: `Terminal "${terminal_name}" not found`,
        available_terminals: available.map(t => t.name || t.id),
      };
    }

    const buffer = this.terminalService.getTerminalBuffer(terminal_name, lines);

    return {
      success: true,
      terminal: terminal.name || terminal.id,
      output: buffer || '',
      lines_returned: buffer?.split('\n').length || 0,
    };
  }

  private createResponse(id: number | string, result: any): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  private createErrorResponse(id: number | string, code: number, message: string, data?: any): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data && { data }),
      },
    };
  }
}
