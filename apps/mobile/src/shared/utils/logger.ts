/**
 * Centralized logging service for the Trace mobile app
 *
 * Replaces scattered console.log statements with structured logging
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Environment-aware (debug logs only in dev by default)
 * - Runtime debug mode for production troubleshooting
 * - Log buffer with export capability for bug reports
 * - Structured context data
 * - Predefined scopes with icons for consistency
 * - Easy to extend with remote logging (Sentry, LogRocket, etc.)
 *
 * Usage:
 * - Normal logging: logger.info('message', { context })
 * - Scoped logging: const log = createScopedLogger(LogScopes.Sync)
 * - Production debug: User enables in Settings, reproduces bug, exports logs
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share, Platform } from 'react-native';

// ============================================================================
// Log Scopes - Predefined areas with consistent icons
// ============================================================================

/**
 * Predefined logging scopes for consistency across the codebase.
 * Each scope has a unique icon and name.
 *
 * To add a new scope:
 * 1. Add it here with a descriptive name and unique icon
 * 2. Use it via: createScopedLogger(LogScopes.YourNewScope)
 */
export const LogScopes = {
  // === Core Infrastructure ===
  App: { icon: '📱', name: 'App' },
  Init: { icon: '🚀', name: 'Init' },
  Config: { icon: '⚙️', name: 'Config' },

  // === Data & Sync ===
  Sync: { icon: '🔄', name: 'Sync' },
  SyncPush: { icon: '⬆️', name: 'SyncPush' },
  SyncPull: { icon: '⬇️', name: 'SyncPull' },
  Database: { icon: '💾', name: 'Database' },
  Cache: { icon: '📦', name: 'Cache' },
  Migration: { icon: '🔧', name: 'Migration' },

  // === Authentication ===
  Auth: { icon: '🔐', name: 'Auth' },
  OAuth: { icon: '🔑', name: 'OAuth' },
  Session: { icon: '👤', name: 'Session' },

  // === Entries Module ===
  Entry: { icon: '📄', name: 'Entry' },
  EntryForm: { icon: '📝', name: 'EntryForm' },
  EntryNav: { icon: '⬅️', name: 'EntryNav' },
  EntryApi: { icon: '📡', name: 'EntryApi' },
  Autosave: { icon: '💾', name: 'Autosave' },

  // === Media ===
  Photos: { icon: '📷', name: 'Photos' },
  Attachments: { icon: '📎', name: 'Attachments' },
  PhotoGallery: { icon: '🖼️', name: 'PhotoGallery' },

  // === Location ===
  Location: { icon: '📍', name: 'Location' },
  Geocode: { icon: '🗺️', name: 'Geocode' },
  GPS: { icon: '🛰️', name: 'GPS' },
  LocationPicker: { icon: '🎯', name: 'LocationPicker' },

  // === Streams ===
  Streams: { icon: '📚', name: 'Streams' },
  StreamApi: { icon: '📡', name: 'StreamApi' },

  // === UI Components ===
  Editor: { icon: '✏️', name: 'Editor' },
  Navigation: { icon: '🧭', name: 'Navigation' },
  Settings: { icon: '⚙️', name: 'Settings' },
  Map: { icon: '🗺️', name: 'Map' },

  // === Profile ===
  Profile: { icon: '👤', name: 'Profile' },

  // === Version & Updates ===
  Version: { icon: '📦', name: 'Version' },
} as const;

/** Type for a log scope */
export type LogScope = typeof LogScopes[keyof typeof LogScopes];

/** Type for scope keys (for documentation/reference) */
export type LogScopeKey = keyof typeof LogScopes;

// ============================================================================
// Log Levels
// ============================================================================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.NONE]: 'NONE',
};

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
}

const STORAGE_KEY = 'trace_debug_mode';
const DEFAULT_BUFFER_SIZE = 1000;

class Logger {
  private currentLevel: LogLevel;
  private enableEmojis: boolean;
  private debugModeEnabled: boolean = false;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize: number = DEFAULT_BUFFER_SIZE;
  private initialized: boolean = false;

  constructor() {
    // In development: show all logs including debug
    // In production: only show warnings and errors (until debug mode enabled)
    this.currentLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.WARN;
    this.enableEmojis = true;

    // Initialize from stored setting (async, non-blocking)
    this.initFromStorage();
  }

  /**
   * Initialize debug mode from AsyncStorage
   * Called automatically on construction, but can be called again if needed
   */
  private async initFromStorage(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'true') {
        this.debugModeEnabled = true;
        this.currentLevel = LogLevel.DEBUG;
      }
      this.initialized = true;
    } catch {
      // Silently fail - will use defaults
      this.initialized = true;
    }
  }

  /**
   * Set the minimum log level to display
   * Useful for testing specific scenarios
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugModeEnabled(): boolean {
    return this.debugModeEnabled;
  }

  /**
   * Enable or disable debug mode
   * When enabled in production, all logs are captured and can be exported
   *
   * @param enabled - Whether to enable debug mode
   * @param persist - Whether to save the setting (default: true)
   */
  async setDebugMode(enabled: boolean, persist: boolean = true): Promise<void> {
    this.debugModeEnabled = enabled;
    this.currentLevel = enabled ? LogLevel.DEBUG : (__DEV__ ? LogLevel.DEBUG : LogLevel.WARN);

    if (persist) {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, String(enabled));
      } catch {
        // Silently fail
      }
    }

    // Log the mode change (will be captured in buffer)
    this.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Clear the log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Get the number of entries in the buffer
   */
  getBufferSize(): number {
    return this.logBuffer.length;
  }

  /**
   * Set maximum buffer size
   */
  setMaxBufferSize(size: number): void {
    this.maxBufferSize = size;
    // Trim if needed
    while (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  /**
   * Add entry to the log buffer (circular buffer)
   */
  private addToBuffer(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_NAMES[level],
      message,
      context: context ? this.sanitizeContext(context) : undefined,
    };

    this.logBuffer.push(entry);

    // Circular buffer - remove oldest when full
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  /**
   * Sanitize context to ensure it's serializable
   */
  private sanitizeContext(context: LogContext): LogContext {
    try {
      // Deep clone and sanitize
      return JSON.parse(JSON.stringify(context, (key, value) => {
        // Handle circular references and non-serializable values
        if (typeof value === 'function') return '[Function]';
        if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
        return value;
      }));
    } catch {
      return { _error: 'Failed to serialize context' };
    }
  }

  /**
   * Export logs as a formatted string for bug reports
   */
  exportLogs(): string {
    const header = [
      '=== Trace Debug Logs ===',
      `Exported: ${new Date().toISOString()}`,
      `Platform: ${Platform.OS} ${Platform.Version}`,
      `Debug Mode: ${this.debugModeEnabled}`,
      `Log Level: ${LOG_LEVEL_NAMES[this.currentLevel]}`,
      `Buffer Size: ${this.logBuffer.length}/${this.maxBufferSize}`,
      '========================',
      '',
    ].join('\n');

    const logs = this.logBuffer.map(entry => {
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      return `${entry.timestamp} [${entry.level}] ${entry.message}${contextStr}`;
    }).join('\n');

    return header + logs;
  }

  /**
   * Export logs as JSON (for programmatic use)
   */
  exportLogsAsJSON(): { metadata: object; logs: LogEntry[] } {
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        platform: Platform.OS,
        platformVersion: Platform.Version,
        debugMode: this.debugModeEnabled,
        logLevel: LOG_LEVEL_NAMES[this.currentLevel],
        bufferSize: this.logBuffer.length,
        maxBufferSize: this.maxBufferSize,
      },
      logs: [...this.logBuffer],
    };
  }

  /**
   * Share logs via native share sheet
   */
  async shareLogs(): Promise<void> {
    const content = this.exportLogs();

    try {
      await Share.share({
        message: content,
        title: 'Trace Debug Logs',
      });
    } catch (error) {
      this.error('Failed to share logs', error);
    }
  }

  /**
   * Debug logs - detailed information for troubleshooting
   * Only visible in development mode or when debug mode is enabled
   */
  debug(message: string, context?: LogContext): void {
    // Always buffer if debug mode enabled (even if not printing)
    if (this.debugModeEnabled || __DEV__) {
      this.addToBuffer(LogLevel.DEBUG, message, context);
    }

    if (this.currentLevel <= LogLevel.DEBUG) {
      const prefix = this.enableEmojis ? '🔍' : '[DEBUG]';
      console.log(`${prefix} ${message}`, context || '');
    }
  }

  /**
   * Info logs - general informational messages
   * Example: "User logged in", "Sync completed"
   */
  info(message: string, context?: LogContext): void {
    // Always buffer info and above
    this.addToBuffer(LogLevel.INFO, message, context);

    if (this.currentLevel <= LogLevel.INFO) {
      const prefix = this.enableEmojis ? 'ℹ️' : '[INFO]';
      console.log(`${prefix} ${message}`, context || '');
    }
  }

  /**
   * Warning logs - something unexpected but handled
   * Example: "Photo not found", "Network slow"
   */
  warn(message: string, context?: LogContext): void {
    // Always buffer warnings
    this.addToBuffer(LogLevel.WARN, message, context);

    if (this.currentLevel <= LogLevel.WARN) {
      const prefix = this.enableEmojis ? '⚠️' : '[WARN]';
      console.warn(`${prefix} ${message}`, context || '');
    }
  }

  /**
   * Error logs - errors that need attention
   * Example: "Failed to save entry", "Database error"
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    // Always buffer errors with error details
    const errorContext = {
      ...context,
      error: error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error,
    };
    this.addToBuffer(LogLevel.ERROR, message, errorContext);

    if (this.currentLevel <= LogLevel.ERROR) {
      const prefix = this.enableEmojis ? '❌' : '[ERROR]';
      console.error(`${prefix} ${message}`, error || '', context || '');

      // TODO: Send to remote error tracking (Sentry, Bugsnag, etc.)
      // if (!__DEV__) {
      //   Sentry.captureException(error, { extra: context });
      // }
    }
  }

  /**
   * Success logs - operation completed successfully
   */
  success(message: string, context?: LogContext): void {
    // Buffer success as INFO level
    this.addToBuffer(LogLevel.INFO, `✓ ${message}`, context);

    if (this.currentLevel <= LogLevel.INFO) {
      const prefix = this.enableEmojis ? '✅' : '[SUCCESS]';
      console.log(`${prefix} ${message}`, context || '');
    }
  }

  /**
   * Performance timing - measure operation duration
   * Note: Uses Date.now() instead of console.time() for Hermes compatibility
   */
  private timers: Map<string, number> = new Map();

  time(label: string) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      const key = `⏱️ ${label}`;
      this.timers.set(key, Date.now());
      console.log(`${key} [started]`);
    }
  }

  timeEnd(label: string) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      const key = `⏱️ ${label}`;
      const startTime = this.timers.get(key);
      if (startTime !== undefined) {
        const duration = Date.now() - startTime;
        console.log(`${key}: ${duration}ms`);
        this.timers.delete(key);
      } else {
        console.log(`${key} [timer not found]`);
      }
    }
  }

  /**
   * Group related logs together (useful for complex operations)
   * Note: Hermes doesn't support console.group, so we use a visual prefix instead
   */
  private groupDepth: number = 0;

  group(label: string) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      const indent = '  '.repeat(this.groupDepth);
      console.log(`${indent}▼ ${label}`);
      this.groupDepth++;
    }
  }

  groupEnd() {
    if (this.currentLevel <= LogLevel.DEBUG) {
      if (this.groupDepth > 0) {
        this.groupDepth--;
      }
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for contexts
export type { LogContext };

/**
 * Scoped logger interface - same methods as main logger but with fixed scope prefix
 */
export interface ScopedLogger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, error?: Error | unknown, context?: LogContext) => void;
  success: (message: string, context?: LogContext) => void;
  time: (label: string) => void;
  timeEnd: (label: string) => void;
  group: (label: string) => void;
  groupEnd: () => void;
}

/**
 * Create a scoped logger with a predefined scope from LogScopes.
 *
 * PREFERRED: Use LogScopes for consistency:
 * @example
 * const log = createScopedLogger(LogScopes.Sync);
 * log.info('Starting sync'); // Output: 🔄 [Sync] Starting sync
 *
 * LEGACY (still supported during migration):
 * @example
 * const log = createScopedLogger('CustomScope', '🎯');
 * log.info('Message'); // Output: 🎯 [CustomScope] Message
 *
 * All logs go through the main logger, so they are:
 * - Buffered for export
 * - Respect debug mode settings
 * - Include the scope in the message
 */
export function createScopedLogger(scope: LogScope): ScopedLogger;
export function createScopedLogger(scopeName: string, icon?: string): ScopedLogger;
export function createScopedLogger(scopeOrName: LogScope | string, icon?: string): ScopedLogger {
  // Determine scope name and icon
  let scopeName: string;
  let scopeIcon: string | undefined;

  if (typeof scopeOrName === 'object' && 'name' in scopeOrName && 'icon' in scopeOrName) {
    // LogScope object
    scopeName = scopeOrName.name;
    scopeIcon = scopeOrName.icon;
  } else {
    // Legacy string format
    scopeName = scopeOrName;
    scopeIcon = icon;
  }

  // Format: "[Scope] message" with icon prepended
  const formatMessage = (message: string) => `[${scopeName}] ${message}`;

  const logWithIcon = (
    method: 'debug' | 'info' | 'warn' | 'error' | 'success',
    message: string,
    contextOrError?: LogContext | Error | unknown,
    context?: LogContext
  ) => {
    // Always include icon if available
    const iconMessage = scopeIcon ? `${scopeIcon} ${formatMessage(message)}` : formatMessage(message);
    if (method === 'error') {
      logger[method](iconMessage, contextOrError as Error, context);
    } else {
      logger[method](iconMessage, contextOrError as LogContext);
    }
  };

  return {
    debug: (message: string, context?: LogContext) => {
      logWithIcon('debug', message, context);
    },
    info: (message: string, context?: LogContext) => {
      logWithIcon('info', message, context);
    },
    warn: (message: string, context?: LogContext) => {
      logWithIcon('warn', message, context);
    },
    error: (message: string, error?: Error | unknown, context?: LogContext) => {
      logWithIcon('error', message, error, context);
    },
    success: (message: string, context?: LogContext) => {
      logWithIcon('success', message, context);
    },
    time: (label: string) => logger.time(`[${scopeName}] ${label}`),
    timeEnd: (label: string) => logger.timeEnd(`[${scopeName}] ${label}`),
    group: (label: string) => logger.group(scopeIcon ? `${scopeIcon} [${scopeName}] ${label}` : `[${scopeName}] ${label}`),
    groupEnd: () => logger.groupEnd(),
  };
}
