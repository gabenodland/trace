# Trace Mobile App - Sitemap & Navigation Architecture

## Core Concept: Primary vs Secondary Screens

**Primary Screens** = The "home base" - 3 modes of viewing your content:
- **Entry List** (default) - Text/card view of entries
- **Map** - Geographic view of entries
- **Calendar** - Date-based view of entries

**Secondary Screens** = Detail/settings pages accessed from Primary:
- Entry (view/edit)
- Profile, Settings, Database Info
- Streams (manage), Stream Properties
- Locations (manage)

**Key Behavior:**
- Primary screens remember their state (which stream, filters, etc.)
- `[←]` on Secondary always returns to **last Primary screen**
- Switching stream/map/calendar updates what "Primary" means
- Example: Coffee stream → Settings → `[←]` = back to Coffee stream

---

## Screen Inventory

### Authentication (Unauthenticated)
```
Login Screen
Sign Up Screen
```

### Primary Screens (3 view modes)
```
Entry List     - Text/card view, filtered by stream (HOME BASE)
Map            - Geographic view of entries
Calendar       - Date-based view of entries
```

### Secondary Screens
```
Entry Screen (capture)    - View/edit single entry
Profile Screen            - User profile settings
Settings Screen           - App settings
Database Info Screen      - Debug/sync info
Locations Screen          - Manage saved locations
Streams Screen            - Manage streams list
Stream Properties Screen  - Edit single stream (nested under Streams)
```

---

## Current Navigation Elements

| Element | Location | Purpose | Issues |
|---------|----------|---------|--------|
| Left Hamburger | TopBar left | Opens stream drawer | New, works |
| Breadcrumb | TopBar center | Shows current stream | Has dropdown arrow |
| Breadcrumb Dropdown | TopBar | Opens EntryNavigator modal | Heavy, does too much |
| Search Icon | TopBar right | Toggle search bar | Works |
| Right Hamburger | TopBar right | Opens NavigationMenu | Cluttered, unclear purpose |
| SubBar | Below TopBar | View/Sort selectors | Only on Entry List |
| FAB | Bottom right | New entry | Only on Entry List |

---

## Proposed Navigation Architecture

### Level 0: App Shell
```
┌─────────────────────────────────────────────────────────┐
│                      [TopBar]                           │
│  [Menu]  [Title/Breadcrumb]              [Search] [👤]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    [Screen Content]                     │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
                                                    [FAB]
```

### Level 1: Primary Navigation (Left Drawer)
Purpose: **Content Navigation** - What am I viewing? How am I viewing it?

```
┌──────────────────────────┐
│  VIEW MODE               │
│                          │
│  List                  * │  ← Current mode highlighted
│  Map                     │
│  Calendar                │
│  ─────────────────────── │
│  STREAMS                 │
│                          │
│  All Entries         142 │
│  Unassigned            8 │
│  ─────────────────────── │
│  Work                  34 │
│  Personal              56 │
│  Health                12 │
│  ...                      │
│                          │
└──────────────────────────┘
```

**Behavior:**
- Tapping Map/Calendar switches to that Primary mode (remembers current stream)
- Tapping a stream filters the current view mode
- Example: On Map + Coffee stream → tap "Work" → Map + Work stream

### Level 2: Profile Menu (Top Right Avatar)
Purpose: **Account & Settings** - Who am I? App config?

```
                    ┌──────────────────────────┐
                    │  Gabriel              👤 │
                    │  ─────────────────────── │
                    │  Profile                 │
                    │  Streams (manage)        │
                    │  Locations (manage)      │
                    │  Settings                │
                    │  Database Info           │
                    │  ─────────────────────── │
                    │  Sign Out                │
                    └──────────────────────────┘
```

**Behavior:**
- Tapping any item closes menu and navigates to that Secondary screen
- `[←]` on any of these returns to last Primary screen

---

## Screen-by-Screen Header Specification

### Entry List Screen (Home)
```
┌─────────────────────────────────────────────────────────┐
│  [≡]  All Entries  (142)                    [🔍]  [👤] │
├─────────────────────────────────────────────────────────┤
│  View: Cards          Sort: Date (desc)                 │
├─────────────────────────────────────────────────────────┤
```
- Left: Drawer toggle (hamburger)
- Center: Current stream name + count (tappable? -> drawer)
- Right: Search + Profile avatar

### Entry Screen (View/Edit)
```
┌─────────────────────────────────────────────────────────┐
│  [←]  Entry Title                           [Save/Edit] │
├─────────────────────────────────────────────────────────┤
```
- Left: Back arrow (returns to Entry List)
- Center: Entry title or "New Entry"
- Right: Action button (Edit/Save/Delete)

### Calendar Screen
```
┌─────────────────────────────────────────────────────────┐
│  [≡]  Calendar                              [🔍]  [👤]  │
├─────────────────────────────────────────────────────────┤
```
- Left: Drawer toggle
- Center: "Calendar" title
- Right: Search + Profile

### Locations Screen
```
┌─────────────────────────────────────────────────────────┐
│  [≡]  Locations                             [🔍]  [👤]  │
├─────────────────────────────────────────────────────────┤
```

### Map Screen
```
┌─────────────────────────────────────────────────────────┐
│  [≡]  Map                                   [🔍]  [👤]  │
├─────────────────────────────────────────────────────────┤
```

### Profile Screen
```
┌─────────────────────────────────────────────────────────┐
│  [←]  Profile                                           │
├─────────────────────────────────────────────────────────┤
```
- Left: Back arrow
- Center: "Profile" title
- Right: None (or Save if editing)

### Settings Screen
```
┌─────────────────────────────────────────────────────────┐
│  [←]  Settings                                          │
├─────────────────────────────────────────────────────────┤
```

### Streams Screen (Manage)
```
┌─────────────────────────────────────────────────────────┐
│  [←]  Streams                                      [+]  │
├─────────────────────────────────────────────────────────┤
```
- Left: Back arrow
- Center: "Streams" title
- Right: Add new stream button

### Stream Properties Screen
```
┌─────────────────────────────────────────────────────────┐
│  [←]  Edit Stream                              [Save]   │
├─────────────────────────────────────────────────────────┤
```

### Database Info Screen
```
┌─────────────────────────────────────────────────────────┐
│  [←]  Database Info                                     │
├─────────────────────────────────────────────────────────┤
```

---

## Screen Classification

### Primary Screens (Show Drawer + Profile)
These are "top-level" views accessible from the drawer:
- Entry List
- Calendar
- Locations
- Map

**Header Pattern:** `[≡] Title [🔍] [👤]`

### Secondary Screens (Show Back + Action)
These are "detail" views navigated to from primary screens:
- Entry Screen
- Profile
- Settings
- Database Info
- Streams (manage)
- Stream Properties

**Header Pattern:** `[←] Title [Action?]`

---

## Navigation Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              PRIMARY SCREENS                            │
│                         (The "Home Base" - 3 modes)                     │
│                                                                         │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐            │
│   │ Entry List  │ ←──► │    Map      │ ←──► │  Calendar   │            │
│   │ (default)   │      │             │      │             │            │
│   └──────┬──────┘      └──────┬──────┘      └──────┬──────┘            │
│          │                    │                    │                    │
│          └────────────────────┼────────────────────┘                    │
│                               │                                         │
│                    All filtered by current STREAM                       │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │
                                │ navigate to detail/settings
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SECONDARY SCREENS                             │
│                                                                         │
│   Simple (flat back to Primary):                                        │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │   Entry     │  │   Profile   │  │  Settings   │  │  DB Info    │   │
│   │   [←]       │  │   [←]       │  │   [←]       │  │   [←]       │   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
│   Nested (management flows):                                            │
│   ┌─────────────┐      ┌─────────────────────┐                         │
│   │  Streams    │ ───► │  Stream Properties  │                         │
│   │  [←]        │      │  [←] back to list   │                         │
│   └─────────────┘      └─────────────────────┘                         │
│                                                                         │
│   ┌─────────────┐      ┌─────────────────────┐                         │
│   │  Locations  │ ───► │  Location Details   │  (future)               │
│   │  [←]        │      │  [←] back to list   │                         │
│   └─────────────┘      └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Nested Flow Behavior (Streams → Stream Properties)

**Question:** When on Stream Properties, where does `[←]` go?

**Answer:** Back to Streams list (linear flow within management context).

```
Primary (Coffee)
    │
    ▼ Profile Menu → Streams
┌─────────────────────────────────────────┐
│  MANAGEMENT CONTEXT                     │
│                                         │
│  Streams List ──► Stream Properties     │
│      [←]              [←]               │
│       │                │                │
│       │                └── back to Streams List
│       │
│       └── back to Primary (Coffee)
│
└─────────────────────────────────────────┘
```

**Header for Stream Properties:**
```
┌─────────────────────────────────────────────────────────┐
│  [←]  Coffee Stream                            [Save]   │
├─────────────────────────────────────────────────────────┤
```
- `[←]` returns to Streams list
- Title shows stream name (no breadcrumb trail needed)
- Action area shows Save button

---

## Action Items

### Phase 1: Enhance Left Drawer
- [ ] Add "VIEW MODE" section at top (List, Map, Calendar)
- [ ] Keep "STREAMS" section with All/Unassigned + stream list
- [ ] Track current view mode in DrawerContext
- [ ] Switching view mode navigates to that Primary screen
- [ ] Switching stream filters current view mode

### Phase 2: Replace Hamburger with Profile Avatar
- [ ] Remove right hamburger icon from TopBar
- [ ] Add profile avatar/icon in its place
- [ ] Avatar tap opens ProfileMenu (dropdown)

### Phase 3: Refactor Profile Menu Content
- [ ] Profile
- [ ] Streams (manage)
- [ ] Locations (manage)
- [ ] Settings
- [ ] Database Info
- [ ] Sign Out
- [ ] Remove: Entries, Map, Calendar (now in drawer)

### Phase 4: Standardize Headers
- [ ] Primary screens: `[≡] Title (count) [🔍] [👤]`
- [ ] Secondary screens: `[←] Title [Action?]`
- [ ] Nested screens (Stream Props): `[←]` goes to parent list

### Phase 5: Update All Screens
- [ ] Entry List: Primary header (already done)
- [ ] Map: Primary header + drawer integration
- [ ] Calendar: Primary header + drawer integration
- [ ] Entry: Secondary header (back + save/edit)
- [ ] Profile: Secondary header (back)
- [ ] Settings: Secondary header (back)
- [ ] Streams: Secondary header (back + add)
- [ ] Stream Properties: Secondary header (back + save)
- [ ] Locations: Secondary header (back + add?)
- [ ] Database Info: Secondary header (back)

---

## Design Principles

1. **Clear hierarchy**: Drawer = content nav, Profile = account/settings
2. **Consistent headers**: Same pattern for same screen type
3. **Minimal taps**: One tap to switch streams, one tap to access settings
4. **No duplication**: Each nav item lives in exactly one place
5. **Discoverable**: Profile avatar is universally understood
6. **Clean**: No emoji icons, simple text, generous whitespace
