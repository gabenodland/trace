import { describe, it, expect } from 'vitest';
import { diffEntryManifests, RemoteManifestEntry, LocalManifestEntry } from './manifestDiff';

function makeLocal(overrides: Partial<LocalManifestEntry> = {}): LocalManifestEntry {
  return {
    version: 1,
    base_version: 1,
    deleted_at: null,
    synced: 1,
    sync_action: null,
    ...overrides,
  };
}

function makeRemote(entry_id: string, overrides: Partial<RemoteManifestEntry> = {}): RemoteManifestEntry {
  return {
    entry_id,
    version: 1,
    deleted_at: null,
    ...overrides,
  };
}

describe('diffEntryManifests', () => {
  it('returns empty diff when both sides are empty', () => {
    const result = diffEntryManifests(new Map(), []);
    expect(result.toFetch).toEqual([]);
    expect(result.toSoftDelete).toEqual([]);
    expect(result.toReconcile).toEqual([]);
  });

  it('returns empty diff when both sides match', () => {
    const localMap = new Map([
      ['a', makeLocal({ version: 3, base_version: 3 })],
      ['b', makeLocal({ version: 5, base_version: 5 })],
    ]);
    const remote = [
      makeRemote('a', { version: 3 }),
      makeRemote('b', { version: 5 }),
    ];
    const result = diffEntryManifests(localMap, remote);
    expect(result.toFetch).toEqual([]);
    expect(result.toSoftDelete).toEqual([]);
    expect(result.toReconcile).toEqual([]);
  });

  it('detects new entries on server (missing locally)', () => {
    const localMap = new Map<string, LocalManifestEntry>();
    const remote = [
      makeRemote('a', { version: 1 }),
      makeRemote('b', { version: 2 }),
    ];
    const result = diffEntryManifests(localMap, remote);
    expect(result.toFetch).toEqual(['a', 'b']);
    expect(result.toSoftDelete).toEqual([]);
    expect(result.toReconcile).toEqual([]);
  });

  it('detects deleted entries on server that are missing locally', () => {
    const localMap = new Map<string, LocalManifestEntry>();
    const remote = [
      makeRemote('a', { version: 1, deleted_at: '2026-01-01T00:00:00Z' }),
    ];
    const result = diffEntryManifests(localMap, remote);
    expect(result.toFetch).toEqual([]);
    expect(result.toSoftDelete).toHaveLength(1);
    expect(result.toSoftDelete[0].entry_id).toBe('a');
  });

  it('detects server version ahead of local base_version', () => {
    const localMap = new Map([
      ['a', makeLocal({ version: 3, base_version: 3 })],
    ]);
    const remote = [makeRemote('a', { version: 5 })];
    const result = diffEntryManifests(localMap, remote);
    expect(result.toFetch).toEqual(['a']);
  });

  it('skips entries with local unsynced changes (synced=0)', () => {
    const localMap = new Map([
      ['a', makeLocal({ version: 4, base_version: 3, synced: 0, sync_action: 'update' })],
    ]);
    const remote = [makeRemote('a', { version: 5 })];
    const result = diffEntryManifests(localMap, remote);
    expect(result.toFetch).toEqual([]);
  });

  it('detects server soft-delete when local is alive', () => {
    const localMap = new Map([
      ['a', makeLocal({ version: 3, base_version: 3 })],
    ]);
    const remote = [makeRemote('a', { version: 3, deleted_at: '2026-01-01T00:00:00Z' })];
    const result = diffEntryManifests(localMap, remote);
    expect(result.toFetch).toEqual([]);
    expect(result.toSoftDelete).toHaveLength(1);
    expect(result.toSoftDelete[0].entry_id).toBe('a');
  });

  it('skips when both sides are deleted', () => {
    const localMap = new Map([
      ['a', makeLocal({ version: 3, base_version: 3, deleted_at: '2026-01-01T00:00:00Z' })],
    ]);
    const remote = [makeRemote('a', { version: 3, deleted_at: '2026-01-01T00:00:00Z' })];
    const result = diffEntryManifests(localMap, remote);
    expect(result.toFetch).toEqual([]);
    expect(result.toSoftDelete).toEqual([]);
  });

  it('detects entries missing from server (synced locally)', () => {
    const localMap = new Map([
      ['a', makeLocal({ version: 3, base_version: 3 })],
      ['b', makeLocal({ version: 2, base_version: 2 })],
    ]);
    const remote = [makeRemote('a', { version: 3 })];
    // 'b' is missing from server
    const result = diffEntryManifests(localMap, remote);
    expect(result.toReconcile.sort()).toEqual(['b']);
  });

  it('does NOT reconcile local_only entries missing from server', () => {
    const localMap = new Map([
      ['a', makeLocal({ version: 1, base_version: 1, synced: 1 })],
    ]);
    // Even though synced=1 and missing from server, local_only entries
    // should be excluded from the localMap before calling diffEntryManifests.
    // The diff function itself doesn't know about local_only — the caller filters.
    const remote: RemoteManifestEntry[] = [];
    const result = diffEntryManifests(localMap, remote);
    // This WOULD show up as toReconcile — caller must filter local_only before passing
    expect(result.toReconcile).toEqual(['a']);
  });

  it('does NOT reconcile entries with synced=0 missing from server', () => {
    const localMap = new Map([
      ['a', makeLocal({ version: 1, base_version: 0, synced: 0, sync_action: 'create' })],
    ]);
    const remote: RemoteManifestEntry[] = [];
    const result = diffEntryManifests(localMap, remote);
    expect(result.toReconcile).toEqual([]);
  });

  it('does NOT reconcile deleted local entries missing from server', () => {
    const localMap = new Map([
      ['a', makeLocal({ version: 3, base_version: 3, deleted_at: '2026-01-01T00:00:00Z' })],
    ]);
    const remote: RemoteManifestEntry[] = [];
    const result = diffEntryManifests(localMap, remote);
    expect(result.toReconcile).toEqual([]);
  });

  it('handles mixed scenario correctly', () => {
    const localMap = new Map([
      ['synced', makeLocal({ version: 3, base_version: 3 })],           // matches server
      ['outdated', makeLocal({ version: 3, base_version: 3 })],         // server has v5
      ['dirty', makeLocal({ version: 4, base_version: 3, synced: 0 })], // pending push
      ['orphan', makeLocal({ version: 2, base_version: 2 })],           // missing from server
      ['both-del', makeLocal({ version: 1, base_version: 1, deleted_at: '2026-01-01T00:00:00Z' })],
    ]);
    const remote = [
      makeRemote('synced', { version: 3 }),
      makeRemote('outdated', { version: 5 }),
      makeRemote('dirty', { version: 5 }),
      makeRemote('new-entry', { version: 1 }),
      makeRemote('new-deleted', { version: 1, deleted_at: '2026-01-01T00:00:00Z' }),
      makeRemote('both-del', { version: 1, deleted_at: '2026-01-01T00:00:00Z' }),
    ];

    const result = diffEntryManifests(localMap, remote);

    expect(result.toFetch.sort()).toEqual(['new-entry', 'outdated']);
    expect(result.toSoftDelete.map(e => e.entry_id).sort()).toEqual(['new-deleted']);
    expect(result.toReconcile).toEqual(['orphan']);
  });

  it('skips entries with matching versions even when local version > base_version (pending push)', () => {
    // Local version is 4 (local edit), base_version is 3 (last synced), server is 3
    // synced=0 so this should be skipped (push handles it)
    const localMap = new Map([
      ['a', makeLocal({ version: 4, base_version: 3, synced: 0, sync_action: 'update' })],
    ]);
    const remote = [makeRemote('a', { version: 3 })];
    const result = diffEntryManifests(localMap, remote);
    expect(result.toFetch).toEqual([]);
    expect(result.toReconcile).toEqual([]);
  });
});
