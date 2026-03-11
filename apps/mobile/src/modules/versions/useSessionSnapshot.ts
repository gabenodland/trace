/**
 * useSessionSnapshot - Creates a version snapshot when an editing session ends
 *
 * Triggers:
 * - Editor closes (screen becomes invisible)
 * - App backgrounds while editing
 *
 * Constraints:
 * - Only creates a snapshot if the entry was modified (dirty check via change_summary)
 * - Only one snapshot per open/close cycle (deduplication via ref flag)
 * - Fire-and-forget — never blocks UI
 * - Failures are logged, never thrown
 */

import { useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildSnapshot, generateChangeSummary } from './versionHelpers';
import { createVersion } from './versionApi';
import { versionKeys } from './versionHooks';
import { getDeviceId } from '../../config/appVersionService';
import { localDB } from '../../shared/db/localDB';
import { createScopedLogger } from '../../shared/utils/logger';
import type { EntrySnapshot } from './VersionTypes';
import type { BaseEntry } from '@trace/core';

const log = createScopedLogger('SessionSnapshot');

export function useSessionSnapshot() {
  const queryClient = useQueryClient();
  // Snapshot of the entry at the start of this editing session
  const openSnapshotRef = useRef<EntrySnapshot | null>(null);
  // Attachment IDs at the start of this editing session
  const openAttachmentIdsRef = useRef<string[] | null>(null);
  // Guard: only one snapshot per session
  const snapshotCreatedRef = useRef(false);

  /**
   * Call when an entry is loaded for editing (or when originalEntry is set).
   * Captures the baseline snapshot for dirty comparison.
   */
  const captureOpenSnapshot = useCallback((entry: BaseEntry, attachmentIds?: string[]) => {
    openSnapshotRef.current = buildSnapshot(entry);
    openAttachmentIdsRef.current = attachmentIds ?? null;
    snapshotCreatedRef.current = false;
    log.debug('Captured open snapshot', {
      entryId: entry.entry_id?.substring(0, 8),
      attachmentCount: attachmentIds?.length ?? 0,
    });
  }, []);

  /**
   * Reset state when navigating away from an entry entirely.
   */
  const resetSession = useCallback(() => {
    openSnapshotRef.current = null;
    openAttachmentIdsRef.current = null;
    snapshotCreatedRef.current = false;
  }, []);

  /**
   * Create a session_end version if the entry was modified.
   * Fire-and-forget — caller should not await this.
   *
   * Uses entry.user_id — no separate auth dependency needed.
   */
  const createSessionSnapshot = useCallback(async (currentEntry: BaseEntry, currentAttachmentIds?: string[]) => {
    log.debug('createSessionSnapshot called', {
      entryId: currentEntry.entry_id?.substring(0, 8),
      hasOpenSnapshot: !!openSnapshotRef.current,
      alreadyCreated: snapshotCreatedRef.current,
    });

    // Guard: already created a snapshot this session
    if (snapshotCreatedRef.current) {
      log.debug('SKIP: Snapshot already created this session');
      return;
    }

    // Guard: no baseline to compare against
    if (!openSnapshotRef.current) {
      log.debug('SKIP: No open snapshot captured');
      return;
    }

    // Guard: no user_id on entry
    if (!currentEntry.user_id) {
      log.debug('SKIP: No user_id on entry');
      return;
    }

    try {
      const currentSnapshot = buildSnapshot(currentEntry);
      const currAttIds = currentAttachmentIds ?? null;
      const changeSummary = generateChangeSummary(
        currentSnapshot,
        openSnapshotRef.current,
        currAttIds,
        openAttachmentIdsRef.current,
      );

      log.debug('Dirty check', {
        changeSummary: changeSummary || '(no changes)',
      });

      // No meaningful changes — skip
      if (!changeSummary) {
        log.debug('SKIP: No changes detected');
        return;
      }

      // Mark as created BEFORE the async call to prevent race conditions
      snapshotCreatedRef.current = true;

      const deviceId = await getDeviceId();
      const now = new Date().toISOString();

      // Read base_version from SQLite (source of truth) to avoid stale React Query cache
      let baseVersion = (currentEntry as any).base_version || 1;
      try {
        const rows = await localDB.runCustomQuery(
          'SELECT base_version FROM entries WHERE entry_id = ? LIMIT 1',
          [currentEntry.entry_id]
        );
        if (rows.length > 0 && rows[0].base_version != null) {
          baseVersion = rows[0].base_version;
        }
      } catch {
        // Fall back to React prop value
      }

      await createVersion({
        entry_id: currentEntry.entry_id,
        user_id: currentEntry.user_id,
        trigger: 'session_end',
        snapshot: currentSnapshot,
        attachment_ids: currAttIds,
        change_summary: changeSummary,
        device_id: deviceId,
        triggered_by_device: null,
        device_created_at: now,
        base_entry_version: String(baseVersion),
        created_at: now,
      });

      // Invalidate React Query cache so version history shows the new version immediately
      queryClient.invalidateQueries({ queryKey: versionKeys.forEntry(currentEntry.entry_id) });

      log.info('Version created', {
        entryId: currentEntry.entry_id?.substring(0, 8),
        changeSummary,
      });
    } catch (error) {
      // Snapshot failure must never break the editor
      log.error('Failed to create session snapshot', error, {
        entryId: currentEntry.entry_id,
      });
      // Reset the flag so it can be retried (e.g., on app background after close failure)
      snapshotCreatedRef.current = false;
    }
  }, [queryClient]);

  return {
    captureOpenSnapshot,
    createSessionSnapshot,
    resetSession,
  };
}
