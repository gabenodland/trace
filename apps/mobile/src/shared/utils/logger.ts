/**
 * Centralized logging service for the Trace mobile app
 *
 * Replaces scattered console.log statements with structured logging
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Environment-aware (debug logs only in dev)
 * - Structured context data
 * - Easy to extend with remote logging (Sentry, LogRocket, etc.)
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface LogContext {
  [key: string]: any;
}

class Logger {
  private currentLevel: LogLevel;
  private enableEmojis: boolean;

  constructor() {
    // In development: show all logs including debug
    // In production: only show warnings and errors
    this.currentLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.WARN;
    this.enableEmojis = true;
  }

  /**
   * Set the minimum log level to display
   * Useful for testing specific scenarios
   */
  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }

  /**
   * Debug logs - detailed information for troubleshooting
   * Only visible in development mode
   */
  debug(message: string, context?: LogContext) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      const prefix = this.enableEmojis ? '🔍' : '[DEBUG]';
      console.log(`${prefix} ${message}`, context || '');
    }
  }

  /**
   * Info logs - general informational messages
   * Example: "User logged in", "Sync completed"
   */
  info(message: string, context?: LogContext) {
    if (this.currentLevel <= LogLevel.INFO) {
      const prefix = this.enableEmojis ? 'ℹ️' : '[INFO]';
      console.log(`${prefix} ${message}`, context || '');
    }
  }

  /**
   * Warning logs - something unexpected but handled
   * Example: "Photo not found", "Network slow"
   */
  warn(message: string, context?: LogContext) {
    if (this.currentLevel <= LogLevel.WARN) {
      const prefix = this.enableEmojis ? '⚠️' : '[WARN]';
      console.warn(`${prefix} ${message}`, context || '');
    }
  }

  /**
   * Error logs - errors that need attention
   * Example: "Failed to save entry", "Database error"
   */
  error(message: string, error?: Error | unknown, context?: LogContext) {
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
  success(message: string, context?: LogContext) {
    if (this.currentLevel <= LogLevel.INFO) {
      const prefix = this.enableEmojis ? '✅' : '[SUCCESS]';
      console.log(`${prefix} ${message}`, context || '');
    }
  }

  /**
   * Performance timing - measure operation duration
   */
  time(label: string) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.time(`⏱️ ${label}`);
    }
  }

  timeEnd(label: string) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.timeEnd(`⏱️ ${label}`);
    }
  }

  /**
   * Group related logs together (useful for complex operations)
   */
  group(label: string) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.group(`📦 ${label}`);
    }
  }

  groupEnd() {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for contexts
export type { LogContext };

/**
 * Create a scoped logger with a fixed prefix
 * Useful for logging from a specific module/component
 *
 * @example
 * const log = createScopedLogger('SyncQueue');
 * log.info('Starting sync'); // Output: ℹ️ [SyncQueue] Starting sync
 */
export function createScopedLogger(scope: string) {
  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(`[${scope}] ${message}`, context),
    info: (message: string, context?: LogContext) =>
      logger.info(`[${scope}] ${message}`, context),
    warn: (message: string, context?: LogContext) =>
      logger.warn(`[${scope}] ${message}`, context),
    error: (message: string, error?: Error | unknown, context?: LogContext) =>
      logger.error(`[${scope}] ${message}`, error, context),
    success: (message: string, context?: LogContext) =>
      logger.success(`[${scope}] ${message}`, context),
    time: (label: string) => logger.time(`[${scope}] ${label}`),
    timeEnd: (label: string) => logger.timeEnd(`[${scope}] ${label}`),
    group: (label: string) => logger.group(`[${scope}] ${label}`),
    groupEnd: () => logger.groupEnd(),
  };
}
