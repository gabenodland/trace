# Entry Editing Data Flow Analysis

## Current Architecture

```
┌─────────────┐     realtime      ┌─────────────┐
│  Supabase   │ ───subscription──▶│  LocalDB    │
│  (Cloud)    │                   │  (SQLite)   │
└─────────────┘                   └─────────────┘
       ▲                                 │
       │                                 │
   sync push                        React Query
       │                                 │
       │                                 ▼
       │                          ┌─────────────┐
       └──────────────────────────│  CaptureForm│
                                  │  (UI)       │
                                  └─────────────┘
```

**Key insight**: LocalDB is updated by realtime subscription. This is the ONLY path for cloud → local updates.

## Normal Editing Flow (No Conflicts)

```mermaid
sequenceDiagram
    participant User
    participant Form as CaptureForm
    participant WD as workingData
    participant LDB as LocalDB
    participant Sync as SyncService
    participant Cloud as Supabase

    User->>Form: Opens entry from list
    Form->>LDB: Load entry
    LDB-->>Form: Entry data (version=5)
    Form->>WD: Initialize workingData
    Note over WD: dirty=false, baseVersion=5

    User->>Form: Clicks into edit mode
    Note over WD: Still dirty=false

    User->>Form: Types "hello"
    Form->>WD: Update content
    Note over WD: dirty=true

    Note over Form: 10s debounce...

    Form->>LDB: Save workingData
    Note over LDB: version=6, synced=0
    LDB-->>Form: Saved
    Note over WD: dirty=false, baseVersion=6

    Sync->>Cloud: Push entry (version=6)
    Cloud-->>Sync: OK (version=6)
    Sync->>LDB: Mark synced=1
```

## Conflict Scenario: Remote Update During Editing

```mermaid
sequenceDiagram
    participant UserA as User A (Phone)
    participant UserB as User B (Tablet)
    participant LDB_A as LocalDB A
    participant LDB_B as LocalDB B
    participant Cloud as Supabase

    Note over UserA,Cloud: Both devices have entry at version=5

    UserA->>LDB_A: Open entry, start editing
    Note over LDB_A: workingData initialized

    UserB->>LDB_B: Open entry, edit, save
    LDB_B->>Cloud: Push (version=6)
    Cloud-->>LDB_A: Realtime: entry updated!

    Note over LDB_A: LocalDB updated to version=6
    Note over LDB_A: But workingData still has old content!

    UserA->>LDB_A: 10s debounce fires, try to save
    Note over LDB_A: CONFLICT!
    Note over LDB_A: workingData.baseVersion=5
    Note over LDB_A: LocalDB.version=6
```

## The Core Problem

When autosave triggers:
1. `workingData` has user's edits based on version=5
2. `LocalDB` now has version=6 from realtime sync
3. If we save workingData → we lose User B's changes
4. If we don't save → we lose User A's changes

## Option Analysis

### Option 1: Last Writer Wins (Current Broken Behavior)
- Simple but loses data
- ❌ Not acceptable

### Option 2: Block LocalDB Updates While Editing
- Don't apply realtime updates to entries being edited
- Pro: Simple, user's work is never disrupted
- Con: User A won't see User B's changes until they close and reopen
- Con: When User A saves, they'll overwrite User B's work

### Option 3: Merge on Save (Complex)
- Detect conflict on save
- Attempt automatic merge (content concatenation, field-level merge)
- Pro: Both changes preserved
- Con: Complex, merge could produce garbage
- Con: What if both edited the same paragraph?

### Option 4: Fork on Conflict
- When conflict detected on save, create a copy
- Original entry gets User B's version (from cloud)
- New "conflict copy" entry gets User A's version
- Pro: No data loss
- Con: User has to manually reconcile later
- Con: Multiple devices could create many forks

### Option 5: Warn and Let User Choose (Recommended)
- When realtime update arrives for entry being edited:
  - Show indicator: "This entry was updated by another device"
  - Continue letting user edit (don't disrupt)
- When user tries to save (or autosave triggers):
  - If conflict detected, show dialog:
    - "Keep my changes" (overwrites remote)
    - "Discard my changes" (loads remote version)
    - "Save as copy" (creates new entry with user's changes)

## Proposed Simplified Flow

```mermaid
sequenceDiagram
    participant User
    participant Form as CaptureForm
    participant WD as workingData
    participant LDB as LocalDB
    participant RT as Realtime

    User->>Form: Open entry
    Form->>LDB: Load (version=5)
    Form->>WD: Initialize (baseVersion=5)

    User->>WD: Edit content
    Note over WD: dirty=true

    RT->>LDB: Update arrives (version=6)
    Note over LDB: Entry updated to v6

    LDB-->>Form: React Query detects change
    Form->>Form: Check: is entry locked for editing?
    alt Entry is locked
        Form->>Form: Set staleFlag=true
        Form->>User: Show "Newer version available" badge
        Note over WD: workingData unchanged
    else Entry not locked
        Form->>WD: Update workingData to v6
    end

    User->>Form: Trigger save (debounce or exit)
    Form->>Form: Check baseVersion vs LocalDB version
    alt No conflict (baseVersion >= LocalDB version)
        Form->>LDB: Save normally
    else Conflict detected
        Form->>User: Show conflict dialog
        User->>Form: Choose resolution
        alt Keep my changes
            Form->>LDB: Save (overwrites v6)
        else Discard my changes
            Form->>WD: Reload from LocalDB
        else Save as copy
            Form->>LDB: Create new entry with my changes
        end
    end
```

## Three Device Scenario

```mermaid
sequenceDiagram
    participant A as Device A
    participant B as Device B
    participant C as Device C
    participant Cloud as Supabase

    Note over A,Cloud: All start at version=5

    A->>A: Start editing
    B->>B: Start editing
    C->>C: Start editing

    B->>Cloud: Save (version=6)
    Cloud-->>A: Realtime v6
    Cloud-->>C: Realtime v6
    Note over A: staleFlag=true (editing)
    Note over C: staleFlag=true (editing)

    A->>Cloud: Try save → Conflict dialog
    A->>A: User chooses "Keep mine"
    A->>Cloud: Save (version=7)
    Cloud-->>B: Realtime v7
    Cloud-->>C: Realtime v7
    Note over C: staleFlag=true (still editing)

    C->>Cloud: Try save → Conflict dialog
    C->>C: User chooses "Save as copy"
    C->>Cloud: Create new entry with C's changes
```

## Key Decisions Needed

1. **When does "locked for editing" start?**
   - Option A: When entry form opens (view mode)
   - Option B: When user enters edit mode
   - Option C: When user makes first change (dirty=true)

2. **What triggers conflict check?**
   - Every autosave (2s/10s debounce)
   - Only on form close
   - Both

3. **Should we show the conflict dialog during autosave?**
   - Could be annoying if user is actively typing
   - Maybe only show on exit/manual save?

4. **What about the "stale" indicator?**
   - Just a badge? Or more prominent?
   - Should user be able to "refresh" to see remote changes?

## Recommended Implementation

1. **Simplify**: Remove all the complex race condition handling
2. **Lock early**: Lock entry when form opens (even in view mode)
3. **Stale flag**: When realtime update arrives for locked entry, set flag but don't update workingData
4. **Conflict on save**: Check LocalDB version vs baseVersion before saving
5. **User decides**: Show dialog only when user tries to close/navigate away with unsaved changes AND there's a conflict
6. **Don't auto-merge**: Too complex, let user decide

## Data Model Changes

No schema changes needed. We already have:
- `version` - incremented on each save
- `base_version` - version we started editing from
- `synced` - 0=unsynced, 1=synced

The conflict is detected by comparing:
```typescript
const hasConflict = localDB.entry.version > workingData.baseVersion;
```
