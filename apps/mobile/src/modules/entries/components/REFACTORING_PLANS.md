# EntryScreen Refactoring Plans

## Item 7: useUnifiedScroll Hook Extraction

### Overview
Extract all scroll-related state, refs, and logic into a dedicated custom hook.
This will reduce EntryScreen.tsx by ~200 lines and isolate scroll coordination complexity.

### State & Refs to Extract

**Exposed State (returned by hook):**
- `showTitleInHeader` - boolean, controls header title visibility
- `isHeaderCollapsed` - boolean, controls CL/HL mode (scrollLocked prop)
- `collapsibleHeight` - number, measured height of collapsible section

**Internal Refs (encapsulated in hook):**
- `isAtTopRef` - tracks if WebView content is at top (for pull-to-reveal detection)
- `drawerAnim` - Animated.Value for header position (0=collapsed, 1=expanded)
- `drawerProgressRef` - mirrors drawerAnim for synchronous access in gestures
- `unifiedScrollPos` - current position in unified scroll space (0 to H+contentScroll)
- `gestureStartScroll` - starting position when gesture begins
- `lastContentScrollApplied` - tracks content scroll delta for efficient updates
- `lastScrollTopRef` - last scroll position for velocity calculation
- `lastScrollTimeRef` - timestamp for velocity calculation
- `scrollVelocityRef` - calculated scroll velocity (px/ms)

### Interface Design

```typescript
interface UseUnifiedScrollOptions {
  editorRef: React.RefObject<RichTextEditorRef>;
  onCollapsibleHeightChange?: (height: number) => void;
}

interface UseUnifiedScrollReturn {
  // State (read-only for consumers)
  showTitleInHeader: boolean;
  isHeaderCollapsed: boolean;
  collapsibleHeight: number;

  // Animation values (for interpolation)
  drawerAnim: Animated.Value;
  translateY: Animated.AnimatedInterpolation<number>;
  titleOpacity: Animated.AnimatedInterpolation<number>;

  // PanResponder (for gesture handling)
  panHandlers: PanResponderInstance['panHandlers'];

  // Callbacks
  onCollapsibleLayout: (event: LayoutChangeEvent) => void;
  onEditorScroll: (scrollTop: number) => void;
  onRevealHeader: () => void;

  // Setters (minimal, only for external triggers)
  setCollapsibleHeight: (height: number) => void;
}
```

### Constants (already extracted)
All threshold constants are already defined at module level:
- SCROLL_AT_TOP_THRESHOLD, SCROLL_CL_ENFORCE_THRESHOLD
- TITLE_VISIBILITY_PROGRESS, HEADER_COLLAPSED_PROGRESS
- REVEAL_VELOCITY_THRESHOLD, MOMENTUM_MULTIPLIER
- DRAG_THRESHOLD, VELOCITY_TIME_WINDOW
- REVEAL_ANIMATION_MIN_DURATION, REVEAL_ANIMATION_MAX_DURATION

### Extraction Steps

1. **Create hook file:**
   `apps/mobile/src/modules/entries/components/hooks/useUnifiedScroll.ts`

2. **Move state & refs:**
   Copy all scroll-related state/refs into the hook

3. **Move updateFromUnifiedScroll:**
   This becomes internal to the hook

4. **Move PanResponder:**
   Export panHandlers from the hook

5. **Move onScroll handler:**
   Export as `onEditorScroll` callback

6. **Move interpolations:**
   Calculate translateY and titleOpacity inside hook

7. **Move onLayout handler:**
   For measuring collapsible section height

8. **Update EntryScreen:**
   Replace extracted code with hook usage

### Risk Mitigation
- Hook will be thoroughly tested before integration
- No behavioral changes - pure extraction
- Type check must pass after each step

---

## Item 8: EntryScreen Component Splitting

### Overview
EntryScreen.tsx is ~2100 lines. Split into logical sub-components while
maintaining the unified scroll system (via the hook from Item 7).

### Current Structure Analysis

EntryScreen currently handles:
1. **Entry data loading** - useEntry hook, form state
2. **Form state management** - title, content, date, attributes
3. **Autosave logic** - debounced save, dirty tracking
4. **Scroll coordination** - unified scroll system (to be extracted)
5. **UI mode management** - edit mode, pickers, keyboard
6. **Photo management** - PhotoCapture integration
7. **Rendering** - header, metadata, editor, bottom bar, pickers

### Proposed Component Structure

```
EntryScreen/
├── EntryScreen.tsx           # Main orchestrator (~400 lines)
├── hooks/
│   ├── useUnifiedScroll.ts   # Scroll coordination (Item 7)
│   ├── useEntryForm.ts       # Form state management
│   └── useEntryAutosave.ts   # Autosave logic
├── components/
│   ├── EntryHeader.tsx       # Already exists
│   ├── EntryMetadataBar.tsx  # Metadata chips (existing but inline)
│   ├── EntryTitleInput.tsx   # Title field with animations
│   ├── EntryPhotoSection.tsx # Photo capture integration
│   └── EntryEditorSection.tsx # RichTextEditor wrapper with scroll props
├── EntryScreen.styles.ts     # Already exists
└── index.ts                  # Exports
```

### Component Responsibilities

**EntryScreen.tsx (Orchestrator)**
- Route param handling (entryId)
- Keyboard listeners
- Navigation/back handling
- Composes all sub-components
- Passes props between them

**useEntryForm.ts Hook**
- Form state (title, content, entryDate, etc.)
- Field update handlers
- isDirty calculation
- Field validation

**useEntryAutosave.ts Hook**
- Autosave timer management
- Save mutation integration
- isSaving state
- Debouncing logic

**EntryTitleInput.tsx Component**
- Title TextInput with styling
- Collapse/expand animation
- Focus management
- onLayout for height measurement

**EntryPhotoSection.tsx Component**
- PhotoCapture wrapper
- Collapse toggle
- Photo count display

**EntryEditorSection.tsx Component**
- RichTextEditor with scroll props
- Scroll callbacks (from useUnifiedScroll)
- Edit mode overlay handling

### Extraction Priority Order

1. **useUnifiedScroll** (Item 7) - highest complexity, biggest impact
2. **useEntryForm** - form state is well-isolated
3. **useEntryAutosave** - depends on form state
4. **EntryEditorSection** - already partially isolated
5. **EntryTitleInput** - moderate complexity
6. **EntryPhotoSection** - lowest complexity

### Dependencies Between Components

```
EntryScreen
├── uses useUnifiedScroll (scroll coordination)
├── uses useEntryForm (form state)
├── uses useEntryAutosave (saving)
│
├── renders EntryHeader (receives scroll state)
├── renders EntryMetadataBar (receives form state)
├── renders EntryTitleInput (receives form state, scroll callbacks)
├── renders EntryPhotoSection (receives form state)
├── renders EntryEditorSection (receives scroll state, form state)
└── renders EntryPickers (receives form state)
```

### Risk Mitigation
- Extract one piece at a time
- Type check after each extraction
- Test on device after each component
- No behavioral changes - pure refactoring

---

## Implementation Notes

### Order of Operations
1. Complete Items 1-6 (constants, consolidation, guards) ✅
2. Extract useUnifiedScroll hook (Item 7)
3. Test thoroughly
4. Begin component splitting (Item 8) if time permits

### Testing Strategy
- After each change: `npm run type-check:mobile`
- After each logical chunk: test on device
- Focus on scroll behavior, gesture handling, CL/HL transitions

### Files to Modify
- `EntryScreen.tsx` - reduce from ~2100 to ~800 lines
- New: `hooks/useUnifiedScroll.ts` (~300 lines)
- New: `hooks/useEntryForm.ts` (~150 lines)
- New: `hooks/useEntryAutosave.ts` (~100 lines)
- New: `components/EntryTitleInput.tsx` (~100 lines)
- New: `components/EntryPhotoSection.tsx` (~80 lines)
- New: `components/EntryEditorSection.tsx` (~120 lines)

---

## Deferred Items (Require Discussion)

### Item 2: Route onScroll CL enforcement through updateFromUnifiedScroll
- **Issue:** Current onScroll CL enforcement uses progress-based threshold (HEADER_COLLAPSED_PROGRESS = 0.02)
- **updateFromUnifiedScroll uses:** Position-based threshold (newScrollPos >= H)
- **Risk:** Changing could introduce subtle behavioral differences
- **Recommendation:** Discuss with user before modifying

### Dual Scroll Detection in RTE
- **Issue:** Both native onScroll and injected JS scroll detection are active
- **Current behavior:** Both call the same onScroll callback
- **Observation:** This is redundant but not causing issues
- **Recommendation:** Leave as-is unless performance issues arise
