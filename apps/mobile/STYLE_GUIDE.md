# Mobile Style Guide

Single source of truth for all UI patterns. Every screen, modal, and component must follow these rules.

---

## Screen Types

### 1. Main Screen (3 screens)
Persistent tab views. Never unmount.

| Component | Spec |
|-----------|------|
| Header | `TopBar` — stream title (20px bold), optional search/badge |
| Navigation | `BottomNavBar` — List/Map/Calendar tabs + FAB |
| Content | FlatList or custom scrollable |
| Snackbar | `Snackbar` component (absolute top) |

**Screens:** EntryListScreen, MapScreen, CalendarScreen

### 2. Secondary Screen (9 screens)
Push-style navigation from main views or other secondary screens.

| Component | Spec |
|-----------|------|
| Header | `SecondaryHeader` — title (20px bold) + back arrow + optional right action |
| Back | ArrowLeft icon, navigates via back stack |
| Content | ScrollView or FlatList |

**Screens:** Account, Profile, Settings, Streams, StreamProperties, Subscription, Locations, DatabaseInfo, EditorTest

### 3. Entry Screen (1 screen)
Persistent singleton overlay for editing entries.

| Component | Spec |
|-----------|------|
| Header | `EntryHeader` — back arrow + date/time + save indicator + fullscreen toggle |
| Content | AttributeBar + PhotoGallery + RichTextEditor |
| Toolbar | `EditorToolbar` inside `BottomBar` (keyboard-aware) |

### 4. Bottom Sheet (all overlays)
Every overlay uses `PickerBottomSheet` as its wrapper — config dialogs, pickers, and full-screen editors alike. No exceptions. No `<Modal>` from react-native.

| Component | Spec |
|-----------|------|
| Wrapper | `PickerBottomSheet` (wraps `BottomSheet`) |
| Header | Title (18px semibold, left) + X close (20px, right) + optional subtitle |
| Dismiss | Swipe down, tap backdrop, X button |
| Actions | Optional footer: [Secondary] [Primary] buttons |

For immersive tasks (template editing, location picking, API key creation), use `height="full"` (95% screen). Same wrapper, same header, same dismiss pattern — just taller.

---

## Header Specs

### TopBar (Main Screens)
```
paddingTop: insets.top + 6
paddingHorizontal: 16 (lg)
paddingBottom: 4 (xs)
alignItems: flex-start

Title: 20px (fontSize.xl), fontFamily.bold, text.primary
Badge: 13px semibold, background.tertiary pill
Search icon: 22px, text.primary (accent when active)
  padding: 4 (xs) vertical, 8 (sm) horizontal + hitSlop 6
Dropdown arrow: ChevronDown 20px
```

### SecondaryHeader (Secondary Screens)
```
paddingTop: insets.top + 12
paddingHorizontal: 20 (xl)
paddingBottom: 12 (md)

Title: 20px (fontSize.xl), fontFamily.bold, text.primary
Back: ArrowLeft 24px, padding 12px (48dp touch target), marginLeft: -12
Right action: optional icon/button (e.g., "Create" pill on Streams)
```

### EntryHeader (Entry Screen)
```
paddingTop: topInset + 10
paddingHorizontal: 8 (sm)
paddingBottom: 4

Back: ArrowLeft 20px, padding 14px (48dp touch target)
Center: Date (15px medium) + Time (optional)
Right: Pin/Archive indicators (14px) + save status dot + fullscreen toggle (20px)
```

### SubBar (below TopBar on main screens)
```
SubBar container (Map/Calendar):
  paddingHorizontal: 16 (lg), paddingTop: 4 (xs), paddingBottom: 12 (md)

SubBarFilters (Entry List — View/Sort/Filter):
  paddingHorizontal: 16 (lg), paddingTop: 4 (xs), paddingBottom: 4 (xs)
  Selectors: minHeight 48dp
  Filter button: padding 14px (48dp touch target)
```

---

## Navigation

### Back Stack
The app maintains a navigation history stack. `goBack()` pops the stack, returning to the previous screen — not jumping to the main view.

**Rules:**
- Navigating to a main view (Entries/Map/Calendar) or swiping back to main **resets the entire stack**
- Secondary screens push onto the stack: Account > Settings > Back > Account > Back > Entries

### Back Button
- **Icon:** ArrowLeft (always, never ChevronLeft)
- **Size:** 24px on secondary screens, 20px on entry screen
- **Touch target:** minimum 48dp (icon + padding)

### Close Button (Sheets/Modals)
- **Icon:** X
- **Size:** 20px
- **Color:** text.tertiary
- **Touch target:** minimum 48dp (padding 14px, marginRight -14)

---

## Bottom Sheet Standard

All overlays use `PickerBottomSheet`. The layout:

```
+-------------------------------------+
|  ===  (grabber)                     |
|  Title                          [X] |
|  Optional subtitle                  |
|-------------------------------------|
|  Content...                         |
|-------------------------------------|
|  [Secondary]            [Primary]   |
+-------------------------------------+
```

| Element | Spec |
|---------|------|
| Grabber | 36x4px, border.medium, centered |
| Title | 18px, fontFamily.semibold, text.primary |
| Subtitle | 13px (sm), fontFamily.medium, interactive.primary |
| Close (X) | 20px, text.tertiary, padding 14px (48dp), marginRight -14 |
| Primary button | text.primary bg, background.primary text, 16px medium |
| Secondary button | background.secondary bg, text.primary text (or danger variant) |
| Padding | horizontal 16px (lg), bottom 20px (xl) |
| Keyboard spacer | Auto when `dismissKeyboard=false` and keyboard is open |

**Height presets:**
- `"auto"` — content-driven (default for config dialogs)
- `"small"` — 30% screen (simple pickers)
- `"medium"` — 50% screen
- `"large"` — 75% screen (scrollable content like StatusConfig, TemplateHelp)
- `"full"` — 95% screen (immersive: TemplateEditor, LocationPicker, CreateApiKey)

**Swipe area:**
- `"full"` — default in PickerBottomSheet, swipe anywhere to dismiss
- `"grabber"` — only swipe from grabber bar (use when content has ScrollView or TextInput)

---

## Action Buttons

### Create/Add Button (in headers)
Used on Streams and Integrations screens. Accent pill with icon + text:
```
backgroundColor: functional.accent
paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4
Icon: Plus 16px, white
Text: "Create" 14px, fontFamily.medium, white
```

### ActionSheet
Uses `PickerBottomSheet` with `swipeArea="full"`. Items have icon (20px) + label (base size, semibold). Danger items separated with border, use `functional.overdue` color. Title is generic ("Actions"), stream/item name goes in subtitle.

---

## Touch Targets

**Minimum: 48dp** on all interactive elements. Both stores require this.

If the visual element is smaller (e.g., 20px icon), use padding to fill:
```
20px icon + 14px padding each side = 48dp touch area
24px icon + 12px padding each side = 48dp touch area
```

Use `hitSlop` only when padding would break layout (e.g., TopBar search icon uses reduced padding + hitSlop to avoid inflating row height).

---

## Color Contrast

**Minimum ratios (WCAG AA):**
| Text Type | Ratio |
|-----------|-------|
| Normal text (< 18px) | 4.5:1 |
| Large text (>= 18px bold or >= 24px) | 3:1 |

`text.tertiary` must pass 4.5:1 against `background.primary` on every theme.

---

## Safe Areas

**Always use `useSafeAreaInsets()`** from `react-native-safe-area-context`. Never use:
- `Platform.OS === "ios" ? XX : YY`
- `StatusBar.currentHeight`
- Hardcoded top/bottom padding for status bar or home indicator

The app wraps the root in `<SafeAreaProvider>`. Components access insets via the hook.

---

## Save Patterns

| Pattern | When to Use | Component |
|---------|-------------|-----------|
| **Auto-save** (on blur/back) | Continuous editing (entries, profile fields) | Save indicator dot in header |
| **Explicit save button** | Atomic form submission (stream properties, config modals) | `BottomBar` for screens, `primaryAction` for sheets |

- Explicit save screens must show "Unsaved Changes" alert on back if dirty (use `useBeforeBack` hook)
- Auto-save screens show status dots: saving (red), dirty (orange), saved (green check)
- Floating save buttons always use the shared `BottomBar` component (keyboard-aware), never custom absolute positioning

---

## Shared Primitives

### Button
```typescript
<Button label="Save" onPress={save} variant="primary" />
<Button label="Cancel" onPress={cancel} variant="secondary" />
<Button label="Delete" onPress={del} variant="danger" />
<Button label="More" onPress={more} variant="ghost" />
```
Variants: `primary` (accent bg), `secondary` (border), `danger` (red tint), `ghost` (text only).
All variants: minHeight 48dp, borderRadius md.

### EmptyState
```typescript
<EmptyState
  title="No entries yet"
  subtitle="Tap + to create your first entry"
  icon="FileText"
  action={{ label: "Create Entry", onPress: create }}
/>
```
Centered layout. Title 18px semibold. Use in FlatList `ListEmptyComponent` and conditional empty views.

### LoadingState
```typescript
<LoadingState message="Loading entries..." />
```
Centered spinner + optional text. Use instead of inline `<ActivityIndicator>`.

---

## Design Tokens

### Spacing (themeBase.spacing)
| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight gaps |
| sm | 8px | Small gaps, icon padding |
| md | 12px | Medium gaps, button padding |
| lg | 16px | Standard horizontal padding |
| xl | 20px | Modal padding, section gaps |
| xxl | 24px | Large section gaps |
| xxxl | 32px | Extra large gaps |

### Typography (themeBase.typography.fontSize)
| Token | Value | Usage |
|-------|-------|-------|
| xs | 11px | Tiny labels, badges |
| sm | 13px | SubBar labels, subtitles, descriptions |
| base | 15px | Body text, inputs, date display |
| lg | 17px | (reserved) |
| xl | 20px | All screen titles (TopBar + SecondaryHeader) |
| xxl | 24px | (reserved) |

### Font Weights
| Weight | Token | Usage |
|--------|-------|-------|
| 400 | fontFamily.regular | Body text |
| 500 | fontFamily.medium | Labels, date text, buttons |
| 600 | fontFamily.semibold | Sheet titles, badges, buttons |
| 700 | fontFamily.bold | Screen titles |

### Border Radius (themeBase.borderRadius)
| Token | Value | Usage |
|-------|-------|-------|
| sm | 6px | Small buttons, chips |
| md | 8px | Cards, inputs, action buttons |
| lg | 12px | Dropdowns, search bar, bottom sheet content |
| xl | 16px | Bottom sheet container |
| full | 999px | Badges, avatars, pills |

---

## Icon Usage

All icons use the shared `<Icon>` component (`shared/components/Icon.tsx`) which wraps Lucide icons + custom SVGs.

### Standard Sizes

| Size | Usage | Examples |
|------|-------|---------|
| **12px** | Inline with small text | WifiOff in offline badge, Clock "add time" hint |
| **14px** | Tags, chips, status indicators | Pin/Archive indicators in EntryHeader, chip remove buttons, status badges, ChevronDown in SubBar selectors |
| **16px** | Inline search, list row accessories, create button icons | Search icon in search bars, ChevronRight in settings rows, X clear buttons, Plus in create buttons |
| **18px** | Medium UI elements | Settings gear in config rows, Search in StreamPicker |
| **20px** | Standard action icons | X close in sheets/modals, Back arrow in EntryHeader, ListFilter, RefreshCw, ChevronDown in TopBar, fullscreen toggle |
| **22px** | TopBar action button | Search icon in TopBar |
| **24px** | Primary navigation icons | ArrowLeft back in SecondaryHeader, ChevronLeft/Right in date pickers, nav tab icons |
| **28px** | FAB icon only | Plus in BottomNavBar FAB |
| **48px** | Hero/empty state illustrations | MapPin in empty locations, Layers in empty streams, Star in subscription hero |

### Semantic Icon Map

Use these icons consistently for their assigned meaning. Don't mix them.

| Concept | Icon | Notes |
|---------|------|-------|
| **Back** | `ArrowLeft` | Never ChevronLeft for back navigation |
| **Close / Dismiss** | `X` | Sheets, modals, clear buttons |
| **Forward / Drill-in** | `ChevronRight` | Settings rows, list items that navigate |
| **Dropdown** | `ChevronDown` | TopBar title, SubBar selectors, collapsible sections |
| **Expand/Collapse** | `ChevronDown` / `ChevronUp` | Fullscreen toggle, collapsible headers |
| **Prev / Next** | `ChevronLeft` / `ChevronRight` | Date picker month navigation only |
| **Search** | `Search` | Search bars, search buttons |
| **Add** | `Plus` | FAB, add type button, create actions |
| **Delete** | `Trash2` | Destructive actions |
| **Edit** | `Edit` | Edit template button |
| **Settings/Config** | `Settings` | Stream feature config buttons |
| **Help** | `HelpCircle` | Template help, info tooltips |
| **Info** | `Info` | Informational notes |
| **External link** | `ExternalLink` | Opens browser (privacy policy, terms) |
| **Check / Selected** | `Check` | Checkboxes, selected state, saved confirmation |
| **Pin** | `Pin` | Pinned entry indicator |
| **Archive** | `Archive` | Archived entry indicator |
| **Star** | `Star` | Rating, subscription, favorites |
| **Location** | `MapPin` | Location attribute, empty location state |
| **Stream** | `Layers` | Stream icon, all entries |
| **Type** | `Bookmark` | Entry type attribute |
| **Status** | Via `StatusIcon` component | Maps entry status to icon + color automatically |
| **Priority** | `Flag` | Priority attribute |
| **Due date** | `Calendar` | Due date attribute |
| **Photos** | `Camera` / `CustomCamera` | Photo attribute, camera action |
| **Lock** | `Lock` | Private/pro-only features |
| **Offline** | `WifiOff` | Offline state badge |
| **Refresh** | `RefreshCw` | Sync, reload actions |
| **Sign out** | `LogOut` | Sign out action |
| **Copy** | `Copy` | Copy to clipboard |
| **Undo / Redo** | `Undo2` / `Redo2` | Editor fullscreen toolbar |

### Icon Colors

| Context | Color Token |
|---------|-------------|
| Primary action / interactive | `text.primary` |
| Active / selected tab | `functional.accent` |
| Secondary / muted | `text.tertiary` |
| Disabled | `text.disabled` |
| Destructive / danger | `functional.overdue` |
| Success / complete | `functional.complete` |
| On accent background (FAB, buttons) | `#FFFFFF` (white) |

**Don't** hardcode hex colors for icons — use theme tokens. Exception: white (`#FFFFFF`) on solid accent backgrounds.

---

## Don'ts

- Don't use `<Modal>` from react-native for anything — use `PickerBottomSheet` (including full-screen overlays via `height="full"`)
- Don't use `ChevronLeft` for back — always `ArrowLeft`
- Don't hardcode safe area values — use `useSafeAreaInsets()`
- Don't use raw `TouchableOpacity` for buttons — use `Button` component
- Don't build inline empty states — use `EmptyState` component
- Don't put navigation shortcuts on multiple screens — one canonical location
- Don't use `position: absolute` for floating actions — use `BottomBar`
- Don't use touch targets below 48dp
- Don't use `text.tertiary` that fails 4.5:1 contrast ratio
- Don't use bare icon-only add buttons in headers — use "Create" pill (accent bg + Plus icon + text)
