# Entry Screen Architecture

This document describes the architecture of the EntryScreen system - the screen used for creating and editing journal entries.

## Table of Contents

1. [Overview](#overview)
2. [The Problem It Solves](#the-problem-it-solves)
3. [High-Level Architecture](#high-level-architecture)
4. [Component Hierarchy](#component-hierarchy)
5. [EntryFormContext Deep Dive](#entryformcontext-deep-dive)
6. [Hooks](#hooks)
7. [Data Flow](#data-flow)
8. [Singleton Pattern](#singleton-pattern)
9. [File Reference](#file-reference)

---

## Overview

The EntryScreen is a **persistent, singleton screen** that handles both creating new entries and editing existing ones. It uses a centralized context (`EntryFormContext`) to manage all state, eliminating prop drilling across ~15 components and hooks.

```mermaid
graph TB
    subgraph "App.tsx"
        NAV[Navigation]
    end

    subgraph "EntryScreen (Persistent)"
        ES[EntryScreen]
        EFP[EntryFormProvider]
        ESC[EntryScreenContent]
    end

    subgraph "EntryFormContext"
        CTX[Centralized State<br/>~1200 lines]
    end

    NAV -->|"setEntry(id)"| ES
    NAV -->|"clearEntry()"| ES
    ES --> EFP
    EFP --> CTX
    EFP --> ESC
    ESC -->|"useEntryForm()"| CTX
```

---

## The Problem It Solves

### Before: Prop Drilling Hell

Without the context, the EntryScreen would need to pass 50+ parameters between components:

```
EntryScreen
├── props: entryId, isEditing, formData, updateField, handleSave...
├── MetadataBar (needs: formData, updateField, stream, visibility...)
├── RichTextEditor (needs: content, onChange, editable...)
├── PhotoGallery (needs: entryId, photoCount, onDelete...)
├── EntryPickers (needs: formData, updateField, streams, activePicker...)
└── ...each child needs different subsets of the same state
```

### After: Context-Based

```
EntryScreen
├── EntryFormProvider (holds ALL state)
└── EntryScreenContent
    ├── useEntryForm() → gets what it needs
    ├── MetadataBar → useEntryForm()
    ├── RichTextEditor → useEntryForm()
    ├── PhotoGallery → useEntryForm()
    └── EntryPickers → useEntryForm()
```

---

## High-Level Architecture

```mermaid
flowchart TB
    subgraph "Navigation Layer"
        APP[App.tsx]
    end

    subgraph "Screen Layer"
        ES[EntryScreen.tsx<br/>forwardRef wrapper]
        ESC[EntryScreenContent<br/>Main UI component]
    end

    subgraph "Context Layer"
        EFC[EntryFormContext<br/>~1200 lines of state]
    end

    subgraph "Hook Layer"
        H1[useAutosave]
        H2[useEntryNavigation]
        H3[useGpsCapture]
        H4[useAutoGeocode]
        H5[useEntryPhotos]
        H6[useKeyboardHeight]
    end

    subgraph "UI Components"
        EH[EntryHeader]
        MB[MetadataBar]
        ET[EditorToolbar]
        EP[EntryPickers]
        PG[PhotoGallery]
        RTE[RichTextEditorV2]
    end

    APP -->|"ref.setEntry(id)"| ES
    APP -->|"ref.clearEntry()"| ES
    ES --> EFC
    EFC --> ESC
    ESC --> H1 & H2 & H3 & H4 & H5 & H6
    ESC --> EH & MB & ET & EP & PG & RTE
    H1 & H2 & H3 & H4 & H5 -->|"useEntryForm()"| EFC
```

---

## Component Hierarchy

### EntryScreen.tsx (~900 lines)

The main screen component, split into two parts:

```mermaid
graph TB
    subgraph "EntryScreen (forwardRef)"
        REF[useImperativeHandle<br/>exposes setEntry, clearEntry]
        SETUP[Setup: streams, locations,<br/>settings, user]
    end

    subgraph "EntryFormProvider"
        CTX[Context State]
    end

    subgraph "EntryScreenContent"
        FETCH[useEntry hook<br/>fetches entry data]
        HOOKS[Initialize hooks<br/>autosave, gps, geocode, etc.]
        RENDER[Render UI components]
    end

    REF --> CTX
    SETUP --> CTX
    CTX --> FETCH
    FETCH --> HOOKS
    HOOKS --> RENDER
```

### UI Component Tree

```mermaid
graph TB
    ESC[EntryScreenContent]

    ESC --> EH[EntryHeader<br/>Back button, date/time, fullscreen toggle]
    ESC --> MB[MetadataBar<br/>Stream, location, status, type, rating, priority]
    ESC --> PG[PhotoGallery<br/>Shows entry photos]
    ESC --> RTE[RichTextEditorV2<br/>Title + body editor]
    ESC --> BB[BottomBar<br/>Keyboard-aware container]
    BB --> ET[EditorToolbar<br/>Bold, italic, lists, etc.]
    ESC --> EP[EntryPickers<br/>Bottom sheet modals]
    ESC --> PC[PhotoCapture<br/>Camera/gallery access]

    EP --> SP[StreamPicker]
    EP --> LP[LocationPicker]
    EP --> STP[StatusPicker]
    EP --> TP[TypePicker]
    EP --> DP[DueDatePicker]
    EP --> RP[RatingPicker]
    EP --> PP[PriorityPicker]
    EP --> AP[AttributesPicker]
```

---

## EntryFormContext Deep Dive

The context (~1200 lines) manages ALL state for entry editing. Here's what it contains:

### State Categories

```mermaid
mindmap
  root((EntryFormContext))
    Entry Identity
      entryId
      savedEntryId
      effectiveEntryId
      tempEntryId
      entry object
      isEditing
    Form Data
      title
      content
      streamId/Name
      status
      type
      dueDate
      rating
      priority
      entryDate
      includeTime
      locationData
      geocodeStatus
      pendingPhotos
    Edit Mode
      isEditMode
      isFullScreen
      editModeInitialContent
    Save State
      isSubmitting
      isSaving
    Photo Tracking
      photoCount
      baselinePhotoCount
      externalRefreshKey
      photosCollapsed
    Dirty Tracking
      isDirty
      isFormDirty
      baseline ref
    Version Conflict
      knownVersion
      lastSaveTime
    UI State
      activePicker
      snackbarMessage
    Refs
      editorRef
      photoCaptureRef
      handleSaveRef
      handleAutosaveRef
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `setEntry(id, options)` | Initialize screen for editing (id) or creating (null + options) |
| `clearEntry()` | Reset all state when leaving screen |
| `onEntryLoaded(entry)` | Populate form when entry data arrives from React Query |
| `updateField(field, value)` | Update a single form field |
| `updateMultipleFields(updates)` | Update multiple fields at once |
| `setBaseline(data)` | Set comparison point for dirty tracking |
| `markClean()` | Mark form as saved (not dirty) |
| `enterEditMode()` | Switch from view mode to edit mode |
| `addPendingPhoto(photo)` | Add photo to new entry (before first save) |
| `removePendingPhoto(id)` | Remove pending photo |
| `showSnackbar(msg)` | Show toast message |

### Type Definitions

```typescript
interface CaptureFormData {
  title: string;
  content: string;
  streamId: string | null;
  streamName: string | null;
  status: EntryStatus;
  type: string | null;
  dueDate: string | null;
  rating: number;
  priority: number;
  entryDate: string;
  includeTime: boolean;
  locationData: LocationType | null;
  geocodeStatus: GeocodeStatus;
  pendingPhotos: PendingPhoto[];
}

interface PendingPhoto {
  photoId: string;
  localPath: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  position: number;
}
```

---

## Hooks

Each hook handles a specific concern, all accessing state via `useEntryForm()`:

### useAutosave

```mermaid
sequenceDiagram
    participant User
    participant Hook as useAutosave
    participant Timer as Debounce Timer
    participant MaxTimer as Max Wait Timer
    participant Save as handleAutosave

    User->>Hook: Types content
    Hook->>Timer: Reset 2s timer
    Hook->>MaxTimer: Start 30s timer (if not running)

    alt User stops typing for 2s
        Timer->>Save: Trigger save
        Save->>MaxTimer: Cancel
    else User types continuously for 30s
        MaxTimer->>Save: Force save
        Save->>Timer: Cancel
    end
```

**Purpose:** Automatically saves after user stops typing (2s) or after 30s max continuous typing.

### useEntryNavigation

```mermaid
flowchart TB
    BACK[Back button pressed]

    BACK --> CHECK{Has unsaved changes?}
    CHECK -->|No| NAV[Navigate back]
    CHECK -->|Yes| SAVE[Auto-save first]
    SAVE --> NAV

    NEW{Is new entry?}
    NEW -->|Yes, empty| DISCARD[Discard without saving]
    NEW -->|Yes, has content| SAVE2[Save first]
    DISCARD --> NAV
    SAVE2 --> NAV
```

**Purpose:** Handles back navigation with auto-save. Discards empty new entries, saves dirty entries.

### useGpsCapture

```mermaid
flowchart TB
    START[New entry created]

    START --> CHECK1{GPS setting enabled?}
    CHECK1 -->|No| SKIP[Skip capture]
    CHECK1 -->|Yes| CHECK2{Stream allows location?}
    CHECK2 -->|No| SKIP
    CHECK2 -->|Yes| CHECK3{Already has location?}
    CHECK3 -->|Yes| SKIP
    CHECK3 -->|No| CAPTURE[Capture GPS]

    CAPTURE --> CACHED[Try cached location]
    CACHED --> |Found| DONE[Set location + update baseline]
    CACHED --> |Not found| FRESH[Get fresh GPS]
    FRESH --> DONE
```

**Purpose:** Auto-captures GPS for new entries. Respects user settings and stream configuration.

### useAutoGeocode

```mermaid
flowchart TB
    GPS[GPS coordinates captured]

    GPS --> SNAP{Within 30m of saved location?}
    SNAP -->|Yes| USE[Use saved location's data<br/>city, region, country, etc.]
    SNAP -->|No| GEO[Call Mapbox reverse geocode API]
    GEO --> PARSE[Parse response into fields]
    PARSE --> UPDATE[Update form with geo data]
    USE --> UPDATE
```

**Purpose:** Automatically fills in city/region/country after GPS capture. First tries to snap to saved locations.

### useEntryPhotos

**Purpose:** Handles photo selection, compression, storage, and deletion. For new entries, photos are stored as "pending" until first save.

### useKeyboardHeight

**Purpose:** Tracks keyboard height for proper layout adjustment of the toolbar.

---

## Data Flow

### Creating a New Entry

```mermaid
sequenceDiagram
    participant App
    participant ES as EntryScreen
    participant CTX as EntryFormContext
    participant Editor as RichTextEditor
    participant Auto as useAutosave
    participant DB as Database

    App->>ES: setEntry(null, {streamId})
    ES->>CTX: setEntry(null, options)
    CTX->>CTX: Initialize empty form
    CTX->>Editor: setContent('')

    Note over Editor: User types content
    Editor->>CTX: updateField('content', html)
    CTX->>Auto: isFormDirty = true

    Note over Auto: After 2s pause
    Auto->>CTX: handleAutosave()
    CTX->>DB: createEntry()
    DB-->>CTX: newEntry
    CTX->>CTX: setSavedEntryId(id)

    Note over CTX: Now isEditing = true
    Note over Auto: Subsequent saves → updateEntry()
```

### Editing an Existing Entry

```mermaid
sequenceDiagram
    participant App
    participant ES as EntryScreen
    participant CTX as EntryFormContext
    participant RQ as React Query
    participant Editor as RichTextEditor

    App->>ES: setEntry(entryId)
    ES->>CTX: setEntry(entryId)
    CTX->>CTX: Clear form, wait for entry

    ES->>RQ: useEntry(entryId)
    RQ-->>ES: entry (from cache or fetch)
    ES->>CTX: onEntryLoaded(entry)
    CTX->>CTX: Build formData from entry
    CTX->>CTX: Set baseline for dirty tracking
    CTX->>Editor: setContent(combinedTitleAndBody)

    Note over Editor: User edits
    Editor->>CTX: updateField()
    CTX->>CTX: isFormDirty = true

    Note over CTX: Autosave or manual save
    CTX->>RQ: updateEntry()
```

### Leaving the Screen

```mermaid
sequenceDiagram
    participant App
    participant ES as EntryScreen
    participant CTX as EntryFormContext
    participant Editor as RichTextEditor

    App->>ES: clearEntry()
    ES->>CTX: clearEntry()
    CTX->>Editor: setContent('')
    CTX->>CTX: Reset all state
    CTX->>CTX: entryId = null
    CTX->>CTX: formData = empty
    CTX->>CTX: isEditMode = false

    Note over CTX: Screen is now clean<br/>for next entry
```

---

## Singleton Pattern

### Why Singleton?

The EntryScreen uses a **persistent singleton pattern** to avoid TenTap editor memory leaks:

```mermaid
flowchart LR
    subgraph "Traditional Pattern"
        N1[Navigate to entry] --> M1[Mount screen + editor]
        M1 --> E1[Edit]
        E1 --> B1[Back]
        B1 --> U1[Unmount screen + editor]
        U1 --> N2[Navigate again]
        N2 --> M2[Mount NEW editor<br/>💥 Memory leak!]
    end
```

```mermaid
flowchart LR
    subgraph "Singleton Pattern"
        INIT[App starts] --> MOUNT[Mount screen + editor ONCE]
        MOUNT --> READY[Screen ready]

        READY --> SET1[setEntry 1]
        SET1 --> EDIT1[Edit entry 1]
        EDIT1 --> CLEAR1[clearEntry]
        CLEAR1 --> READY

        READY --> SET2[setEntry 2]
        SET2 --> EDIT2[Edit entry 2]
        EDIT2 --> CLEAR2[clearEntry]
        CLEAR2 --> READY
    end
```

### How It Works

1. **EntryScreen mounts once** at app start
2. **Navigation calls `setEntry(id)`** instead of passing props
3. **Content is swapped** via `editorRef.current.setContent()`
4. **On leave, `clearEntry()`** resets state but doesn't unmount
5. **Editor instance persists** - no memory leaks

---

## File Reference

### Core Files

| File | Lines | Purpose |
|------|-------|---------|
| `EntryScreen.tsx` | ~900 | Main screen component |
| `context/EntryFormContext.tsx` | ~1200 | Centralized state management |
| `EntryScreen.styles.ts` | ~100 | StyleSheet definitions |

### Hooks

| File | Lines | Purpose |
|------|-------|---------|
| `hooks/useAutosave.ts` | ~150 | Debounced autosave with max wait |
| `hooks/useEntryNavigation.ts` | ~170 | Back navigation with auto-save |
| `hooks/useGpsCapture.ts` | ~260 | GPS capture for new entries |
| `hooks/useAutoGeocode.ts` | ~320 | Location snapping + reverse geocode |
| `hooks/useEntryPhotos.ts` | ~200 | Photo handling |
| `hooks/useKeyboardHeight.ts` | ~50 | Keyboard tracking |

### Helpers

| File | Lines | Purpose |
|------|-------|---------|
| `helpers/entryVisibility.ts` | ~90 | Stream-based field visibility |
| `helpers/entrySaveHelpers.ts` | ~150 | GPS/location field building |

### UI Components

| File | Purpose |
|------|---------|
| `EntryHeader.tsx` | Top bar with back, date, time, fullscreen toggle |
| `MetadataBar.tsx` | Stream, location, attributes display |
| `EditorToolbar.tsx` | Formatting buttons (bold, italic, lists) |
| `EntryPickers.tsx` | Coordinator for all bottom sheet pickers |
| `pickers/*.tsx` | Individual picker components |

### External Dependencies

| File | Purpose |
|------|---------|
| `RichTextEditorV2.tsx` | TenTap-based editor wrapper |
| `PhotoGallery.tsx` | Entry photo display |
| `PhotoCapture.tsx` | Camera/gallery access |

---

## Summary

The EntryScreen system is complex but organized:

1. **EntryFormContext** (~1200 lines) is the heart - it holds ALL state
2. **6 hooks** handle specific concerns (autosave, navigation, GPS, etc.)
3. **Singleton pattern** prevents editor memory leaks
4. **setEntry/clearEntry** are the main API for navigation
5. **All components** use `useEntryForm()` to access state

The complexity exists because entries have many features:
- Title + rich text body
- Stream assignment
- Location (GPS + geocoding + saved location snapping)
- Photos (with compression, pending state for new entries)
- Attributes (status, type, due date, rating, priority)
- Autosave with conflict detection
- View mode vs edit mode
- Fullscreen mode

Each feature needs state, and that state needs to be shared across components - hence the large context.
