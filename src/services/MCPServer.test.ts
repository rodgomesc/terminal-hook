import { MCPServer, MCPRequest, MCPResponse } from './MCPServer';
import { TerminalBufferService } from './TerminalBufferService';

jest.mock('./TerminalBufferService');

describe('MCPServer', () => {
  let mcpServer: MCPServer;
  let mockTerminalService: jest.Mocked<TerminalBufferService>;

  beforeEach(() => {
    mockTerminalService = new TerminalBufferService() as jest.Mocked<TerminalBufferService>;
    mcpServer = new MCPServer(mockTerminalService);
  });

  describe('handleRequest', () => {
    it('should return null for notifications (no id)', () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      };

      const response = mcpServer.handleRequest(request);
      expect(response).toBeNull();
    });

    it('should handle initialize request', () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      };

      const response = mcpServer.handleRequest(request);
      
      expect(response).toBeDefined();
      expect(response?.jsonrpc).toBe('2.0');
      expect(response?.id).toBe(1);
      expect(response?.result).toHaveProperty('protocolVersion');
      expect(response?.result).toHaveProperty('capabilities');
      expect(response?.result).toHaveProperty('serverInfo');
      expect(response?.result.serverInfo.name).toBe('terminal-hook');
    });

    it('should handle ping request', () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
      };

      const response = mcpServer.handleRequest(request);
      
      expect(response).toBeDefined();
      expect(response?.jsonrpc).toBe('2.0');
      expect(response?.id).toBe(2);
      expect(response?.result).toEqual({});
    });

    it('should handle tools/list request', () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
      };

      const response = mcpServer.handleRequest(request);
      
      expect(response).toBeDefined();
      expect(response?.result).toHaveProperty('tools');
      expect(Array.isArray(response?.result.tools)).toBe(true);
      expect(response?.result.tools.length).toBe(2);

      const toolNames = response?.result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('list_terminals');
      expect(toolNames).toContain('get_terminal_output');
    });

    it('should return error for unknown method', () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'unknown_method',
      };

      const response = mcpServer.handleRequest(request);
      
      expect(response).toBeDefined();
      expect(response?.error).toBeDefined();
      expect(response?.error?.code).toBe(-32601);
      expect(response?.error?.message).toContain('Method not found');
    });
  });

  describe('tools/call - list_terminals', () => {
    it('should list all terminals with metadata', () => {
      const mockTerminals = [
        {
          id: '1',
          name: 'bash',
          processId: 1234,
          buffer: ['line1', 'line2'],
          createdAt: new Date('2024-01-01'),
          lastActivity: new Date('2024-01-02'),
        },
      ];

      mockTerminalService.getAllTerminals.mockReturnValue(mockTerminals);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'list_terminals',
          arguments: {},
        },
      };

      const response = mcpServer.handleRequest(request);
      
      expect(response).toBeDefined();
      const content = JSON.parse(response!.result.content[0].text);
      
      expect(content.success).toBe(true);
      expect(content.count).toBe(1);
      expect(content.terminals[0].name).toBe('bash');
      expect(content.terminals[0].bufferLines).toBe(2);
    });

    it('should handle empty terminal list', () => {
      mockTerminalService.getAllTerminals.mockReturnValue([]);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'list_terminals',
          arguments: {},
        },
      };

      const response = mcpServer.handleRequest(request);
      
      expect(response).toBeDefined();
      const content = JSON.parse(response!.result.content[0].text);
      
      expect(content.success).toBe(true);
      expect(content.count).toBe(0);
      expect(content.terminals).toEqual([]);
    });
  });

  describe('tools/call - get_terminal_output', () => {
    it('should return terminal output when terminal found', () => {
      const mockTerminal = {
        id: '1',
        name: 'bash',
        processId: 1234,
        buffer: ['line1', 'line2', 'line3'],
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockTerminalService.getTerminal.mockReturnValue(mockTerminal);
      mockTerminalService.getTerminalBuffer.mockReturnValue('line1\nline2\nline3');

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'get_terminal_output',
          arguments: {
            terminal_name: 'bash',
            lines: 100,
          },
        },
      };

      const response = mcpServer.handleRequest(request);
      
      expect(response).toBeDefined();
      const content = JSON.parse(response!.result.content[0].text);
      
      expect(content.success).toBe(true);
      expect(content.terminal).toBe('bash');
      expect(content.output).toContain('line1');
      expect(content.lines_returned).toBeGreaterThan(0);
    });

    it('should return error when terminal_name not provided', () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'get_terminal_output',
          arguments: {},
        },
      };

      const response = mcpServer.handleRequest(request);
      
      expect(response).toBeDefined();
      const content = JSON.parse(response!.result.content[0].text);
      
      expect(content.success).toBe(false);
      expect(content.error).toContain('required');
    });

    it('should return error when terminal not found', () => {
      mockTerminalService.getTerminal.mockReturnValue(undefined);
      mockTerminalService.getAllTerminals.mockReturnValue([
        {
          id: '1',
          name: 'bash',
          processId: 1234,
          buffer: [],
          createdAt: new Date(),
          lastActivity: new Date(),
        },
      ]);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'get_terminal_output',
          arguments: {
            terminal_name: 'nonexistent',
          },
        },
      };

      const response = mcpServer.handleRequest(request);
      
      expect(response).toBeDefined();
      const content = JSON.parse(response!.result.content[0].text);
      
      expect(content.success).toBe(false);
      expect(content.error).toContain('not found');
      expect(content.available_terminals).toBeDefined();
    });
  });

  describe('tools/call - unknown tool', () => {
    it('should return error for unknown tool', () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      };

      const response = mcpServer.handleRequest(request);
      
      expect(response).toBeDefined();
      expect(response?.error).toBeDefined();
      expect(response?.error?.code).toBe(-32601);
      expect(response?.error?.message).toContain('Unknown tool');
    });
  });

  describe('error handling', () => {
    it('should handle tool execution errors gracefully', () => {
      mockTerminalService.getAllTerminals.mockImplementation(() => {
        throw new Error('Service error');
      });

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'list_terminals',
          arguments: {},
        },
      };

      const response = mcpServer.handleRequest(request);
      
      expect(response).toBeDefined();
      expect(response?.error).toBeDefined();
      expect(response?.error?.code).toBe(-32603);
      expect(response?.error?.message).toContain('Tool execution error');
    });
  });
});
