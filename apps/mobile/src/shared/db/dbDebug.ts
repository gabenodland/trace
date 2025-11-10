/**
 * Database debugging utilities
 * Call these from anywhere to inspect database
 */

import { localDB } from './localDB';

/**
 * Log all entries to console
 */
export async function logAllEntries() {
  const entries = await localDB.getAllEntries();
  console.log('📊 All Entries:', entries.length);
  console.table(entries.map(e => ({
    id: e.entry_id.slice(0, 8),
    title: e.title || '(no title)',
    synced: e.synced ? '✅' : '❌',
    local_only: e.local_only ? '🔒' : '',
    action: e.sync_action || '-',
  })));
  return entries;
}

/**
 * Log unsynced entries
 */
export async function logUnsyncedEntries() {
  const entries = await localDB.getUnsyncedEntries();
  console.log('⏳ Unsynced Entries:', entries.length);
  console.table(entries.map(e => ({
    id: e.entry_id.slice(0, 8),
    title: e.title || '(no title)',
    action: e.sync_action,
  })));
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

  console.log('📈 Database Statistics:');
  console.table(stats);
  return stats;
}

/**
 * Log specific entry details
 */
export async function logEntry(entryId: string) {
  const entry = await localDB.getEntry(entryId);
  console.log('🔍 Entry Details:', entry);
  return entry;
}

/**
 * Run custom SQL query
 */
export async function runSQL(sql: string, params?: any[]) {
  console.log('🔍 Running SQL:', sql);
  const result = await localDB.runCustomQuery(sql, params);
  console.table(result);
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
