/**
 * Shared helper for creating sync_overwrite versions.
 *
 * Used by both pullSyncOperations (batch pull) and syncService (realtime)
 * to snapshot the local entry state before a remote update overwrites it.
 */

import { buildSnapshot, generateChangeSummary } from './versionHelpers';
import { createVersion } from './versionApi';
import { wasEditedRecently, clearLocalEdit, markBackupCreated } from './localEditTracker';
import { createScopedLogger } from '../../shared/utils/logger';
import type { BaseEntry } from '@trace/core';

const log = createScopedLogger('SyncOverwrite');

interface SyncOverwriteParams {
  entryId: string;
  userId: string;
  localEntry: BaseEntry;
  remoteEntry: BaseEntry;
  localDeviceId: string | null;
  triggeredByDevice: string | null;
}

/**
 * If the user edited this entry recently, snapshot the local state
 * before a remote update overwrites it.
 *
 * Returns true if a backup version was created, false otherwise.
 */
export async function createSyncOverwriteIfNeeded(params: SyncOverwriteParams): Promise<boolean> {
  const { entryId, userId, localEntry, remoteEntry, localDeviceId, triggeredByDevice } = params;

  if (!wasEditedRecently(entryId)) {
    return false;
  }

  try {
    const localSnapshot = buildSnapshot(localEntry);
    const remoteSnapshot = buildSnapshot(remoteEntry);
    const changeSummary = generateChangeSummary(remoteSnapshot, localSnapshot);

    if (!changeSummary) {
      return false;
    }

    const now = new Date().toISOString();
    await createVersion({
      entry_id: entryId,
      user_id: userId,
      trigger: 'sync_overwrite',
      snapshot: localSnapshot,
      attachment_ids: null,
      change_summary: `before sync: ${changeSummary}`,
      device_id: localDeviceId,
      triggered_by_device: triggeredByDevice,
      device_created_at: now,
      base_entry_version: String((localEntry as any).base_version || 1),
      created_at: now,
    });

    clearLocalEdit(entryId);
    markBackupCreated(entryId);
    log.debug('Saved pre-overwrite version', { entryId, changeSummary });
    return true;
  } catch (error) {
    log.warn('Failed to save pre-overwrite version (non-fatal)', { entryId, error });
    return false;
  }
}
