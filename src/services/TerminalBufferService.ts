import * as vscode from 'vscode';

/// <reference path="./vscode.proposed.terminalDataWriteEvent.d.ts" />

export interface TerminalData {
  id: string;
  name: string;
  processId: number | undefined;
  buffer: string[];
  createdAt: Date;
  lastActivity: Date;
}

export class TerminalBufferService {
  private terminals: Map<string, TerminalData> = new Map();
  private readonly maxBufferLines: number;
  private disposables: vscode.Disposable[] = [];
  private terminalToIdMap: WeakMap<vscode.Terminal, string> = new WeakMap();

  constructor(maxBufferLines: number = 10000) {
    this.maxBufferLines = maxBufferLines;
  }

  public initialize(context: vscode.ExtensionContext): void {
    vscode.window.terminals.forEach(terminal => {
      this.registerTerminal(terminal);
    });

    this.disposables.push(
      vscode.window.onDidOpenTerminal(terminal => {
        this.registerTerminal(terminal);
      })
    );

    this.disposables.push(
      vscode.window.onDidCloseTerminal(terminal => {
        this.unregisterTerminal(terminal);
      })
    );

    if (vscode.window.onDidWriteTerminalData) {
      this.disposables.push(
        vscode.window.onDidWriteTerminalData((event) => {
          this.captureTerminalData(event);
        })
      );
      console.log('[TerminalBufferService] Using onDidWriteTerminalData (proposed API)');
    } else {
      console.warn('[TerminalBufferService] onDidWriteTerminalData not available - terminal capture disabled');
    }
  }

  private captureTerminalData(event: vscode.TerminalDataWriteEvent): void {
    const terminal = event.terminal;
    const data = event.data;
    const id = this.terminalToIdMap.get(terminal);
    if (!id) {
      return;
    }
    
    const terminalData = this.terminals.get(id);
    if (!terminalData) {
      return;
    }

    const cleanData = this.stripAnsiCodes(data);
    const lines = cleanData.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length > 0 && !this.isNoiseLine(trimmedLine)) {
        terminalData.buffer.push(trimmedLine);
      }
    }

    terminalData.lastActivity = new Date();

    if (terminalData.buffer.length > this.maxBufferLines) {
      terminalData.buffer = terminalData.buffer.slice(-this.maxBufferLines);
    }
  }

  private isNoiseLine(line: string): boolean {
    if (/^\d+;/.test(line)) return true;
    if (line.startsWith('1;') || line.startsWith('2;') || line.startsWith('7;')) return true;
    if (line === '➜' || line === '%' || line === '$') return true;
    if (line.includes('OSCLock=') || line.includes('OSCUnlock=')) return true;
    if (line.includes('StartPrompt') || line.includes('EndPrompt')) return true;
    if (line.includes('PreExec') || line.includes('NewCmd=')) return true;
    return false;
  }

  private stripAnsiCodes(str: string): string {
    return str
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B[=>]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/\x07/g, '')
      .replace(/\r/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/.\x08/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/  +/g, ' ')
      .split('\n')
      .map(line => line.trim())
      .join('\n');
  }

  private registerTerminal(terminal: vscode.Terminal): void {
    const id = this.getTerminalId(terminal);
    
    if (!this.terminals.has(id)) {
      const terminalData: TerminalData = {
        id,
        name: terminal.name,
        processId: undefined,
        buffer: [],
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      this.terminals.set(id, terminalData);
      this.terminalToIdMap.set(terminal, id);

      terminal.processId.then(pid => {
        terminalData.processId = pid;
      });
      
      console.log(`[TerminalBufferService] Registered terminal: ${terminal.name} (${id})`);
    }
  }

  private unregisterTerminal(terminal: vscode.Terminal): void {
    const id = this.getTerminalId(terminal);
    this.terminals.delete(id);
    console.log(`[TerminalBufferService] Unregistered terminal: ${terminal.name} (${id})`);
  }

  private terminalCounter: number = 0;

  private getTerminalId(terminal: vscode.Terminal): string {
    let id = this.terminalToIdMap.get(terminal);
    if (!id) {
      id = `terminal-${this.terminalCounter++}-${terminal.name}`;
      this.terminalToIdMap.set(terminal, id);
    }
    return id;
  }

  public getAllTerminals(): TerminalData[] {
    return Array.from(this.terminals.values());
  }

  public getTerminal(nameOrId: string): TerminalData | undefined {
    if (this.terminals.has(nameOrId)) {
      return this.terminals.get(nameOrId);
    }

    const searchTerm = nameOrId.toLowerCase();
    for (const terminal of this.terminals.values()) {
      if (terminal.name.toLowerCase().includes(searchTerm)) {
        return terminal;
      }
    }

    return undefined;
  }

  public getTerminalBuffer(nameOrId: string, lines?: number): string | null {
    const terminal = this.getTerminal(nameOrId);
    
    if (!terminal) {
      return null;
    }

    const buffer = terminal.buffer;
    const requestedLines = lines || buffer.length;
    const startIndex = Math.max(0, buffer.length - requestedLines);
    
    return buffer.slice(startIndex).join('\n');
  }

  public clearTerminalBuffer(nameOrId: string): boolean {
    const terminal = this.getTerminal(nameOrId);
    
    if (terminal) {
      terminal.buffer = [];
      return true;
    }
    
    return false;
  }

  public getTerminalStats(nameOrId: string): {
    totalLines: number;
    bufferSize: number;
    createdAt: Date;
    lastActivity: Date;
  } | null {
    const terminal = this.getTerminal(nameOrId);
    
    if (!terminal) {
      return null;
    }

    return {
      totalLines: terminal.buffer.length,
      bufferSize: terminal.buffer.join('\n').length,
      createdAt: terminal.createdAt,
      lastActivity: terminal.lastActivity,
    };
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.terminals.clear();
  }
}
