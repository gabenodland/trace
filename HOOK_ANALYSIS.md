# CaptureForm.tsx Hook Analysis

## Total Hooks: 52+

### Category 1: FORM DATA STATE (should be ONE object)
These are the actual entry data that gets saved:
- `title` - entry title
- `content` - entry content (HTML)
- `categoryId` - selected category ID
- `categoryName` - category name for display
- `status` - task status (none/incomplete/in_progress/complete)
- `dueDate` - task due date
- `rating` - entry rating (0-5)
- `priority` - entry priority (0-5)
- `entryDate` - entry date/time
- `includeTime` - whether time is included in entryDate
- `captureLocation` - whether to capture GPS location
- `locationData` - location object (coordinates, address, etc.)

**Original: 12 individual useState calls**
**Target: 1 useState with object containing all fields**

### Category 2: PHOTO STATE (extract to useCaptureFormPhotos)
- `photoCount` - number of photos (for position tracking)
- `photosCollapsed` - whether photo gallery is collapsed
- `pendingPhotos` - array of pending photos for new entries
- `tempEntryId` - temp UUID for new entry photo storage
- `photoCaptureRef` - ref to PhotoCapture component

**Original: 4 useState + 1 useRef**
**Target: Custom hook `useCaptureFormPhotos`**

### Category 3: UI STATE - MODALS/PICKERS (extract to useCaptureFormUI)
- `showCategoryPicker` - category picker modal
- `showLocationPicker` - location picker modal
- `showDatePicker` - due date picker modal
- `showRatingPicker` - rating picker modal
- `showPriorityPicker` - priority picker modal
- `showAttributesPicker` - attributes picker modal
- `showNativePicker` - native date/time picker
- `showEntryDatePicker` - entry date picker
- `showTimeModal` - time selection modal
- `showMenu` - navigation menu

**Original: 10 individual useState calls**
**Target: Custom hook `useCaptureFormUI` OR keep in component (these are simple toggles)**

### Category 4: UI STATE - VISUAL (keep in component)
- `isTitleExpanded` - title input expanded/collapsed
- `isEditMode` - read-only vs edit mode
- `isFullScreen` - editor fullscreen mode
- `locationIconBlink` - location icon animation
- `snackbarMessage` - snackbar notification message
- `snackbarOpacity` - animated value for snackbar
- `keyboardHeight` - current keyboard height
- `pickerMode` - date vs time picker mode

**Original: 7 useState + 1 useRef (Animated.Value)**
**Keep in component - these are pure UI concerns**

### Category 5: LOADING/SUBMISSION STATE (keep in component)
- `isSubmitting` - form is being saved

**Keep in component - simple state**

### Category 6: REFS (keep as-is)
- `editorRef` - RichTextEditor ref
- `titleInputRef` - title TextInput ref
- `isInitialLoad` - first load tracker
- `lastTitleTap` - double-tap detection
- `snackbarOpacity` - animated value

**Keep as-is - refs don't count toward hook limit issues**

### Category 7: DATA FOR NAVIGATION (keep in component)
- `originalCategoryId` - for cancel navigation
- `originalCategoryName` - for cancel navigation

**Keep in component - simple state**

### Category 8: EXTERNAL HOOKS (from libraries/contexts)
- `useSettings()` - settings context
- `useEntries()` - entries data hook
- `useEntry(entryId)` - single entry data hook
- `useAuthState()` - auth context
- `useCategories()` - categories data hook
- `useNavigation()` - navigation context
- `useNavigationMenu()` - menu items

**Keep as-is - external dependencies**

## Refactoring Strategy

### Phase 1: Extract Form Data State
**Goal: 12 useState → 1 useState**

Create `useCaptureFormState.ts`:
```typescript
interface CaptureFormData {
  title: string;
  content: string;
  categoryId: string | null;
  categoryName: string | null;
  status: "none" | "incomplete" | "in_progress" | "complete";
  dueDate: string | null;
  rating: number;
  priority: number;
  entryDate: string;
  includeTime: boolean;
  captureLocation: boolean;
  locationData: LocationType | null;
}

function useCaptureFormState(initialData: Partial<CaptureFormData>) {
  const [formData, setFormData] = useState<CaptureFormData>({
    title: "",
    content: initialData.content || "",
    // ... all fields with defaults
  });

  const updateField = useCallback(<K extends keyof CaptureFormData>(
    field: K,
    value: CaptureFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  return { formData, updateField, setFormData };
}
```

### Phase 2: Extract Photo Management
**Goal: Extract photo logic to custom hook**

Create `useCaptureFormPhotos.ts`:
```typescript
function useCaptureFormPhotos(entryId: string | null, tempEntryId: string) {
  const [photoCount, setPhotoCount] = useState(0);
  const [photosCollapsed, setPhotosCollapsed] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const photoCaptureRef = useRef<PhotoCaptureRef>(null);

  const handlePhotoSelected = useCallback(async (uri: string) => {
    // All photo handling logic here
  }, [entryId, tempEntryId]);

  return {
    photoCount,
    setPhotoCount,
    photosCollapsed,
    setPhotosCollapsed,
    pendingPhotos,
    setPendingPhotos,
    photoCaptureRef,
    handlePhotoSelected,
  };
}
```

### Phase 3: Optionally Extract UI State
**Goal: Simplify modal/picker state management**

Create `useCaptureFormUI.ts`:
```typescript
function useCaptureFormUI() {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  // ... all modal states

  return {
    modals: {
      showCategoryPicker,
      showLocationPicker,
      // ... all modal states
    },
    toggleModal: (modal: keyof Modals) => {
      // Toggle logic
    },
  };
}
```

## Expected Results

### Before:
- **52+ total hooks**
- 32 useState calls
- Component: 2,651 lines

### After Phase 1 (Form Data State):
- **42 total hooks** (10 reduction)
- 22 useState calls (12 → 1, but +1 for updateField)
- Component: ~2,600 lines (minimal change)

### After Phase 2 (Photo Management):
- **38 total hooks** (4 more reduction)
- 18 useState calls
- Component: ~2,400 lines (photo logic moved)

### After Phase 3 (Optional UI State):
- **28 total hooks** (10 more reduction)
- 8 useState calls in main component
- Component: ~2,350 lines

### Final Goal:
- **~15-20 total hooks in main component** ✅
- Single formData state object ✅
- Clean separation of concerns ✅
- **IDENTICAL behavior and UX** ✅
