export class Disposable {
  dispose(): void {}
}

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];

  event = (listener: (e: T) => void): Disposable => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      },
    };
  };

  fire(data: T): void {
    this.listeners.forEach(listener => listener(data));
  }
}

export class Uri {
  static file(path: string): Uri {
    return new Uri(path);
  }

  constructor(public readonly path: string) {}
}

export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}

export interface Terminal {
  name: string;
  processId: Thenable<number | undefined>;
  creationOptions: Readonly<TerminalOptions | ExtensionTerminalOptions>;
  exitStatus: TerminalExitStatus | undefined;
  state: TerminalState;
  shellIntegration: TerminalShellIntegration | undefined;
  sendText(text: string, shouldExecute?: boolean): void;
  show(preserveFocus?: boolean): void;
  hide(): void;
  dispose(): void;
}

export interface TerminalOptions {
  name?: string;
}

export interface ExtensionTerminalOptions {
  name: string;
}

export interface TerminalExitStatus {
  code: number | undefined;
  reason: number;
}

export interface TerminalState {
  isInteractedWith: boolean;
  shell: string | undefined;
}

export interface TerminalShellIntegration {
  cwd: Uri | undefined;
}

export interface TerminalShellExecutionCommandLine {
  value: string;
  isTrusted: boolean;
  confidence: number;
}

export interface TerminalShellExecution {
  commandLine: TerminalShellExecutionCommandLine;
  cwd: Uri | undefined;
  read(): AsyncIterable<string>;
}

export interface TerminalShellExecutionStartEvent {
  terminal: Terminal;
  execution: TerminalShellExecution;
}

export interface TerminalShellExecutionEndEvent {
  terminal: Terminal;
  execution: TerminalShellExecution;
  exitCode: number | undefined;
}

export interface SecretStorage {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
  keys(): Thenable<string[]>;
  onDidChange: Event<SecretStorageChangeEvent>;
}

export interface SecretStorageChangeEvent {
  key: string;
}

export interface Event<T> {
  (listener: (e: T) => void): Disposable;
}

export interface Memento {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void>;
  keys(): readonly string[];
}

export interface ExtensionContext {
  subscriptions: Disposable[];
  workspaceState: Memento;
  globalState: Memento & { setKeysForSync(keys: readonly string[]): void };
  secrets: SecretStorage;
  extensionUri: Uri;
  extensionPath: string;
  environmentVariableCollection: GlobalEnvironmentVariableCollection;
  asAbsolutePath(relativePath: string): string;
  storageUri: Uri | undefined;
  storagePath: string | undefined;
  globalStorageUri: Uri;
  globalStoragePath: string;
  logUri: Uri;
  logPath: string;
  extensionMode: ExtensionMode;
  extension: Extension<any>;
  languageModelAccessInformation: LanguageModelAccessInformation;
}

export interface LanguageModelAccessInformation {}
export interface GlobalEnvironmentVariableCollection {}

export interface Extension<T> {
  id: string;
  extensionUri: Uri;
  extensionPath: string;
  isActive: boolean;
  packageJSON: unknown;
  exports: T;
  activate(): Thenable<T>;
}

// Mock implementations for tests

export class MockTerminal implements Terminal {
  public readonly name: string;
  public readonly processId: Thenable<number | undefined>;
  public readonly creationOptions: Readonly<TerminalOptions | ExtensionTerminalOptions>;
  public readonly exitStatus: TerminalExitStatus | undefined;
  public state: TerminalState = { isInteractedWith: false, shell: undefined };
  public readonly shellIntegration: TerminalShellIntegration | undefined = undefined;

  constructor(name: string, processId?: number) {
    this.name = name;
    this.processId = Promise.resolve(processId);
    this.creationOptions = { name };
    this.exitStatus = undefined;
  }

  sendText(text: string, shouldExecute?: boolean): void {}
  show(preserveFocus?: boolean): void {}
  hide(): void {}
  dispose(): void {}
}

class MockMemento implements Memento {
  private storage: Map<string, any> = new Map();

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get(key: string, defaultValue?: any): any {
    return this.storage.has(key) ? this.storage.get(key) : defaultValue;
  }

  update(key: string, value: any): Thenable<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }

  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }
}

class MockSecretStorage implements SecretStorage {
  private storage: Map<string, string> = new Map();
  onDidChange: Event<SecretStorageChangeEvent> = new EventEmitter<SecretStorageChangeEvent>().event;

  get(key: string): Thenable<string | undefined> {
    return Promise.resolve(this.storage.get(key));
  }

  store(key: string, value: string): Thenable<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Thenable<void> {
    this.storage.delete(key);
    return Promise.resolve();
  }

  keys(): Thenable<string[]> {
    return Promise.resolve(Array.from(this.storage.keys()));
  }
}

export class MockExtensionContext {
  subscriptions: Disposable[] = [];
  workspaceState: Memento = new MockMemento();
  globalState: Memento & { setKeysForSync(keys: readonly string[]): void } =
    Object.assign(new MockMemento(), { setKeysForSync: () => {} });
  secrets: SecretStorage = new MockSecretStorage();
  extensionUri = Uri.file('/mock/extension/path');
  extensionPath = '/mock/extension/path';
  environmentVariableCollection = {} as any;
  asAbsolutePath(relativePath: string): string {
    return `/mock/extension/path/${relativePath}`;
  }
  storageUri = Uri.file('/mock/storage');
  storagePath = '/mock/storage';
  globalStorageUri = Uri.file('/mock/global/storage');
  globalStoragePath = '/mock/global/storage';
  logUri = Uri.file('/mock/log');
  logPath = '/mock/log';
  extensionMode = ExtensionMode.Test;
  extension = {} as any;
  languageModelAccessInformation = {} as any;
}

const mockTerminals: Terminal[] = [];
const onDidOpenTerminalEmitter = new EventEmitter<Terminal>();
const onDidCloseTerminalEmitter = new EventEmitter<Terminal>();
const onDidWriteTerminalDataEmitter = new EventEmitter<{ terminal: Terminal; data: string }>();
const onDidStartTerminalShellExecutionEmitter = new EventEmitter<TerminalShellExecutionStartEvent>();
const onDidEndTerminalShellExecutionEmitter = new EventEmitter<TerminalShellExecutionEndEvent>();

export const window = {
  terminals: mockTerminals,
  onDidOpenTerminal: onDidOpenTerminalEmitter.event,
  onDidCloseTerminal: onDidCloseTerminalEmitter.event,
  onDidWriteTerminalData: onDidWriteTerminalDataEmitter.event,
  onDidStartTerminalShellExecution: onDidStartTerminalShellExecutionEmitter.event,
  onDidEndTerminalShellExecution: onDidEndTerminalShellExecutionEmitter.event,
  _mockOnDidOpenTerminal: onDidOpenTerminalEmitter,
  _mockOnDidCloseTerminal: onDidCloseTerminalEmitter,
  _mockOnDidWriteTerminalData: onDidWriteTerminalDataEmitter,
  _mockOnDidStartTerminalShellExecution: onDidStartTerminalShellExecutionEmitter,
  _mockOnDidEndTerminalShellExecution: onDidEndTerminalShellExecutionEmitter,
};
