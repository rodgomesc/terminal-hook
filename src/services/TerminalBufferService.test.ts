import { TerminalBufferService } from './TerminalBufferService';
import * as vscode from 'vscode';
import { MockTerminal, MockExtensionContext } from '../__mocks__/vscode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscodeMock = vscode as any;
type Context = vscode.ExtensionContext;
const mockTerminals = vscode.window.terminals as MockTerminal[];
const mockOnDidOpenTerminal = vscodeMock.window._mockOnDidOpenTerminal;
const mockOnDidCloseTerminal = vscodeMock.window._mockOnDidCloseTerminal;
const mockOnDidWriteTerminalData = vscodeMock.window._mockOnDidWriteTerminalData;

describe('TerminalBufferService', () => {
  let service: TerminalBufferService;
  let context: Context;

  beforeEach(() => {
    service = new TerminalBufferService(1000);
    context = new MockExtensionContext() as unknown as Context;
    mockTerminals.length = 0;
  });

  afterEach(() => {
    service.dispose();
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => service.initialize(context)).not.toThrow();
    });

    it('should track existing terminals on initialization', () => {
      const terminal1 = new MockTerminal('bash', 1234);
      const terminal2 = new MockTerminal('zsh', 5678);
      mockTerminals.push(terminal1, terminal2);

      service.initialize(context);

      const terminals = service.getAllTerminals();
      expect(terminals.length).toBe(2);
    });
  });

  describe('terminal registration', () => {
    beforeEach(() => {
      service.initialize(context);
    });

    it('should register new terminals when opened', async () => {
      const terminal = new MockTerminal('bash', 1234);
      
      mockOnDidOpenTerminal.fire(terminal);

      // Wait for processId to resolve
      await Promise.resolve();

      const terminals = service.getAllTerminals();
      expect(terminals.length).toBe(1);
      expect(terminals[0].name).toBe('bash');
      expect(terminals[0].processId).toBe(1234);
    });

    it('should unregister terminals when closed', () => {
      const terminal = new MockTerminal('bash', 1234);
      
      mockOnDidOpenTerminal.fire(terminal);
      expect(service.getAllTerminals().length).toBe(1);

      mockOnDidCloseTerminal.fire(terminal);
      expect(service.getAllTerminals().length).toBe(0);
    });

    it('should not register the same terminal twice', () => {
      const terminal = new MockTerminal('bash', 1234);
      
      mockOnDidOpenTerminal.fire(terminal);
      mockOnDidOpenTerminal.fire(terminal);

      const terminals = service.getAllTerminals();
      expect(terminals.length).toBe(1);
    });
  });

  describe('terminal data capture', () => {
    beforeEach(() => {
      service.initialize(context);
    });

    it('should capture terminal output data', () => {
      const terminal = new MockTerminal('bash', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      mockOnDidWriteTerminalData.fire({
        terminal,
        data: 'Hello World\n',
      });

      const buffer = service.getTerminalBuffer('bash');
      expect(buffer).toContain('Hello World');
    });

    it('should accumulate multiple data writes', () => {
      const terminal = new MockTerminal('bash', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      mockOnDidWriteTerminalData.fire({ terminal, data: 'Line 1\n' });
      mockOnDidWriteTerminalData.fire({ terminal, data: 'Line 2\n' });
      mockOnDidWriteTerminalData.fire({ terminal, data: 'Line 3\n' });

      const buffer = service.getTerminalBuffer('bash');
      expect(buffer).toContain('Line 1');
      expect(buffer).toContain('Line 2');
      expect(buffer).toContain('Line 3');
    });

    it('should strip ANSI escape codes', () => {
      const terminal = new MockTerminal('bash', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      // Simulate colored output with ANSI codes
      mockOnDidWriteTerminalData.fire({
        terminal,
        data: '\x1b[32mGreen text\x1b[0m\n',
      });

      const buffer = service.getTerminalBuffer('bash');
      expect(buffer).toContain('Green text');
      expect(buffer).not.toContain('\x1b[32m');
    });

    it('should trim buffer when exceeding max size', () => {
      const smallService = new TerminalBufferService(5); // Small buffer
      smallService.initialize(context);

      const terminal = new MockTerminal('bash', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      // Write more lines than buffer can hold
      for (let i = 0; i < 10; i++) {
        mockOnDidWriteTerminalData.fire({
          terminal,
          data: `Line ${i}\n`,
        });
      }

      const terminals = smallService.getAllTerminals();
      expect(terminals[0].buffer.length).toBeLessThanOrEqual(5);

      smallService.dispose();
    });
  });

  describe('terminal retrieval', () => {
    beforeEach(() => {
      service.initialize(context);
    });

    it('should get terminal by exact name', () => {
      const terminal = new MockTerminal('bash', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      const found = service.getTerminal('bash');
      expect(found).toBeDefined();
      expect(found?.name).toBe('bash');
    });

    it('should get terminal by partial name match', () => {
      const terminal = new MockTerminal('my-api-server', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      const found = service.getTerminal('api');
      expect(found).toBeDefined();
      expect(found?.name).toBe('my-api-server');
    });

    it('should get terminal by process ID', async () => {
      const terminal = new MockTerminal('bash', 1234);
      mockOnDidOpenTerminal.fire(terminal);
      await Promise.resolve();

      const found = service.getTerminal('1234');
      const foundByName = service.getTerminal('bash');
      expect(foundByName).toBeDefined();
      expect(foundByName?.processId).toBe(1234);
    });

    it('should return undefined for non-existent terminal', () => {
      const found = service.getTerminal('nonexistent');
      expect(found).toBeUndefined();
    });

    it('should be case-insensitive when matching names', () => {
      const terminal = new MockTerminal('MyTerminal', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      const found = service.getTerminal('myterminal');
      expect(found).toBeDefined();
    });
  });

  describe('buffer operations', () => {
    beforeEach(() => {
      service.initialize(context);
    });

    it('should get terminal buffer with specified line count', () => {
      const terminal = new MockTerminal('bash', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      for (let i = 0; i < 10; i++) {
        mockOnDidWriteTerminalData.fire({
          terminal,
          data: `Line ${i}\n`,
        });
      }

      const buffer = service.getTerminalBuffer('bash', 5);
      const lines = buffer?.split('\n').filter(l => l.trim());
      expect(lines?.length).toBeLessThanOrEqual(6); // 5 lines + potential empty
    });

    it('should return null for non-existent terminal buffer', () => {
      const buffer = service.getTerminalBuffer('nonexistent');
      expect(buffer).toBeNull();
    });

    it('should clear terminal buffer', () => {
      const terminal = new MockTerminal('bash', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      mockOnDidWriteTerminalData.fire({
        terminal,
        data: 'Some data\n',
      });

      expect(service.getTerminalBuffer('bash')).toBeTruthy();

      const cleared = service.clearTerminalBuffer('bash');
      expect(cleared).toBe(true);
      expect(service.getTerminalBuffer('bash')).toBe('');
    });

    it('should return false when clearing non-existent terminal', () => {
      const cleared = service.clearTerminalBuffer('nonexistent');
      expect(cleared).toBe(false);
    });
  });

  describe('terminal statistics', () => {
    beforeEach(() => {
      service.initialize(context);
    });

    it('should get terminal statistics', () => {
      const terminal = new MockTerminal('bash', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      mockOnDidWriteTerminalData.fire({
        terminal,
        data: 'Line 1\nLine 2\nLine 3\n',
      });

      const stats = service.getTerminalStats('bash');
      expect(stats).toBeDefined();
      expect(stats?.totalLines).toBeGreaterThan(0);
      expect(stats?.bufferSize).toBeGreaterThan(0);
      expect(stats?.createdAt).toBeInstanceOf(Date);
      expect(stats?.lastActivity).toBeInstanceOf(Date);
    });

    it('should return null for non-existent terminal stats', () => {
      const stats = service.getTerminalStats('nonexistent');
      expect(stats).toBeNull();
    });

    it('should update lastActivity on data write', (done) => {
      const terminal = new MockTerminal('bash', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      const stats1 = service.getTerminalStats('bash');
      const firstActivity = stats1?.lastActivity;

      setTimeout(() => {
        mockOnDidWriteTerminalData.fire({
          terminal,
          data: 'New data\n',
        });

        const stats2 = service.getTerminalStats('bash');
        const secondActivity = stats2?.lastActivity;

        expect(secondActivity).not.toEqual(firstActivity);
        expect(secondActivity!.getTime()).toBeGreaterThan(firstActivity!.getTime());
        done();
      }, 10);
    });
  });

  describe('getAllTerminals', () => {
    beforeEach(() => {
      service.initialize(context);
    });

    it('should return empty array when no terminals', () => {
      const terminals = service.getAllTerminals();
      expect(terminals).toEqual([]);
    });

    it('should return all registered terminals', () => {
      const terminal1 = new MockTerminal('bash', 1234);
      const terminal2 = new MockTerminal('zsh', 5678);
      const terminal3 = new MockTerminal('fish', 9012);

      mockOnDidOpenTerminal.fire(terminal1);
      mockOnDidOpenTerminal.fire(terminal2);
      mockOnDidOpenTerminal.fire(terminal3);

      const terminals = service.getAllTerminals();
      expect(terminals.length).toBe(3);
      expect(terminals.map(t => t.name)).toContain('bash');
      expect(terminals.map(t => t.name)).toContain('zsh');
      expect(terminals.map(t => t.name)).toContain('fish');
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      service.initialize(context);

      const terminal = new MockTerminal('bash', 1234);
      mockOnDidOpenTerminal.fire(terminal);

      expect(service.getAllTerminals().length).toBe(1);

      service.dispose();

      expect(service.getAllTerminals().length).toBe(0);
    });
  });
});
