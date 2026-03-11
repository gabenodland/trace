/**
 * Tracks when entries were last edited locally by the user.
 * Used by sync to decide whether a sync_overwrite version is needed:
 * only create a backup if the user edited this entry within the last N seconds.
 *
 * In-memory only — resets on app restart, which is fine.
 * If the app restarts, the editor closes → session_end captures the state.
 */

const RECENTLY_EDITED_THRESHOLD_MS = 30_000; // 30 seconds

const lastLocalEditTimes = new Map<string, number>();

/** Call when the user saves/auto-saves an entry. */
export function markLocalEdit(entryId: string): void {
  lastLocalEditTimes.set(entryId, Date.now());
}

/** Returns true if the user edited this entry within the threshold. */
export function wasEditedRecently(entryId: string, thresholdMs: number = RECENTLY_EDITED_THRESHOLD_MS): boolean {
  const lastEdit = lastLocalEditTimes.get(entryId);
  if (!lastEdit) return false;
  return (Date.now() - lastEdit) < thresholdMs;
}

/** Clear the timer after a sync_overwrite version has been created. */
export function clearLocalEdit(entryId: string): void {
  lastLocalEditTimes.delete(entryId);
}

/**
 * Tracks entries that had a backup version created during the most recent sync.
 * Consumed (read-once) by the UI to adjust the snackbar message.
 */
const backupCreatedEntries = new Set<string>();

/** Mark that a backup version was created for this entry. */
export function markBackupCreated(entryId: string): void {
  backupCreatedEntries.add(entryId);
}

/** Check and consume the backup flag (returns true once, then clears). */
export function consumeBackupCreated(entryId: string): boolean {
  if (backupCreatedEntries.has(entryId)) {
    backupCreatedEntries.delete(entryId);
    return true;
  }
  return false;
}
