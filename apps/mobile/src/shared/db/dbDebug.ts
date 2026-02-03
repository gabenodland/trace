/**
 * Database debugging utilities
 * Call these from anywhere to inspect database
 */

import { localDB } from './localDB';
import { createScopedLogger, LogScopes } from '../utils/logger';

const log = createScopedLogger(LogScopes.Database);

/**
 * Log all entries to console
 */
export async function logAllEntries() {
  const entries = await localDB.getAllEntries();
  log.debug('All entries', { count: entries.length });
  return entries;
}

/**
 * Log unsynced entries
 */
export async function logUnsyncedEntries() {
  const entries = await localDB.getUnsyncedEntries();
  log.debug('Unsynced entries', { count: entries.length });
  return entries;
}

/**
 * Log sync statistics
 */
export async function logSyncStats() {
  const all = await localDB.getAllEntries();
  const unsynced = await localDB.getUnsyncedEntries();

  const stats = {
    total: all.length,
    synced: all.filter(e => e.synced).length,
    unsynced: unsynced.length,
    local_only: all.filter(e => e.local_only).length,
    create_pending: all.filter(e => e.sync_action === 'create').length,
    update_pending: all.filter(e => e.sync_action === 'update').length,
    delete_pending: all.filter(e => e.sync_action === 'delete').length,
  };

  log.debug('Database statistics', stats);
  return stats;
}

/**
 * Log specific entry details
 */
export async function logEntry(entryId: string) {
  const entry = await localDB.getEntry(entryId);
  log.debug('Entry details', { entryId, entry });
  return entry;
}

/**
 * Run custom SQL query
 */
export async function runSQL(sql: string, params?: any[]) {
  log.debug('Running SQL', { sql, params });
  const result = await localDB.runCustomQuery(sql, params);
  log.debug('SQL result', { rowCount: result.length });
  return result;
}

// Make available globally for easy debugging
if (global) {
  (global as any).dbDebug = {
    logAllEntries,
    logUnsyncedEntries,
    logSyncStats,
    logEntry,
    runSQL,
  };
}
