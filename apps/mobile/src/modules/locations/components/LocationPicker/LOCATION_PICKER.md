# LocationPicker Component Documentation

> **Purpose:** Reference document for manual testing and feature tracking. Lists all implemented features to prevent regressions when adding new functionality.

---

## Overview

The LocationPicker is a modal bottom sheet that allows users to:
- Select a location from map, search, nearby POIs, or saved places
- Create new named locations (saved to "My Places")
- Drop pins without names (GPS coordinates only)
- View and edit existing saved locations

### Entry Modes

| Mode | When Used | Purpose |
|------|-----------|---------|
| `select` | New entry, changing location | Browse/search and pick a location |
| `create` | After selecting in select mode | Name the location before saving |
| `view` | Viewing existing entry location | Display location with edit options |

---

## Component Architecture

```
LocationPicker/
├── LocationPicker.tsx           # Main orchestrator (~600 lines)
├── hooks/
│   └── useLocationPicker.ts     # All state & business logic (~1125 lines)
├── components/
│   ├── LocationSelectView.tsx   # Map + search + list view
│   ├── CreateLocationView.tsx   # Name entry + precision before save
│   └── CurrentLocationView.tsx  # View/edit existing location
└── LOCATION_PICKER.md           # This document
```

### Data Flow

```
User Action → Component → useLocationPicker hook → API Layer → Database
     ↑              ↓              ↓                    ↓           ↓
     └──── UI Update ←── React Query Cache ←── Response ←──────────┘
```

---

## Inputs & Outputs

### Props

```typescript
{
  visible: boolean              // Controls modal visibility
  onClose: () => void          // Called when user dismisses
  onSelect: (location) => void // Returns selected location or null
  initialLocation?: Location   // Pre-populate with existing location
  mode?: 'select' | 'view'     // Starting mode
}
```

### Output Location Object

```typescript
{
  location_id?: string         // Only if saved to My Places
  name?: string                // User-entered name
  address?: string             // Street address
  city?: string
  region?: string              // State/province
  postal_code?: string
  country?: string
  neighborhood?: string
  latitude: number
  longitude: number
  originalLatitude?: number    // Original GPS coords before snapping
  originalLongitude?: number
  accuracy?: number            // GPS or precision accuracy in meters
}
```

---

## Theme System

All colors are dynamic and come from the app's theme system via `useTheme()`. No colors are hardcoded.

### Theme Colors Used

| Purpose | Theme Property |
|---------|---------------|
| Primary marker | `functional.accent` |
| Preview marker | `functional.accentSecondary` |
| Location card icon bg | `functional.accentLight` |
| Saved location star | `#f59e0b` (amber) |
| Clear/danger actions | `#dc2626` (red) |
| Backgrounds | `background.primary`, `background.secondary` |
| Text | `text.primary`, `text.secondary`, `text.tertiary`, `text.disabled` |
| Borders | `border.light`, `border.medium` |

### Map Theming
- [ ] Map uses `userInterfaceStyle` property based on `dynamicTheme.isDark`
- [ ] Dark themes show dark map style
- [ ] Light themes show standard map style

---

## Units System

Distance and accuracy displays respect the user's unit preference from `useSettings()`.

### Unit-Dependent Displays

| Context | Imperial | Metric |
|---------|----------|--------|
| POI distance | miles/feet | km/meters |
| GPS accuracy | "±X ft" | "±X m" |
| Snap distance | miles/feet | km/meters |
| Precision labels | "~30 ft", "~300 ft", "~1600 ft", "~0.6 mi", "~1 mi" | "~10 m", "~100 m", "~500 m", "~1 km", "~1.5 km" |

### Unit Features
- [ ] Distance formatting uses `formatDistanceWithUnits(meters, settings.units)`
- [ ] GPS accuracy shows feet (imperial) or meters (metric)
- [ ] Precision picker shows appropriate labels per unit setting
- [ ] Snap distance in GPS info card respects units

---

## API Integrations

| API | Provider | Purpose |
|-----|----------|---------|
| Reverse Geocoding | Mapbox | Convert coordinates to address |
| Nearby POIs | Foursquare | List places near marker |
| Autocomplete Search | Foursquare | Search places by text query (50km radius) |
| Saved Locations | SQLite (local) | User's saved "My Places" |

---

## Features by View/Mode

---

### SELECT MODE: Map View

The default view when opening the picker in select mode.

#### Map Display
- [ ] Map centers on user's GPS location on first open
- [ ] Map uses dark/light style matching app theme
- [ ] Blue marker (accent color) shows the currently selected point
- [ ] Red/orange preview marker (accentSecondary) appears when list item is clicked
- [ ] GPS accuracy circle shows around marker (accent color, semi-transparent)
- [ ] Precision circle shows when precision level is set (accent color, more opaque)
- [ ] Search radius circle shows when searching (yellow, dashed, 50km)
- [ ] User's current location shown as blue dot (native iOS/Android)

#### Map Interactions
- [ ] Tap anywhere on map → moves blue marker to that point
- [ ] Tap on map → clears any preview marker and list selection
- [ ] Tap on map → triggers reverse geocoding for address
- [ ] Tap on map → clears GPS accuracy circle (manual placement indicator)
- [ ] Pan/zoom map → updates region state (with debounce for significant changes)
- [ ] Pan map → dismisses keyboard if open
- [ ] Tap Google Maps POI (Android only) → captures POI data, shows in list
- [ ] General area POIs filtered out (park, neighborhood, district, etc.)

#### Map Buttons
- [ ] "My Location" button (crosshairs icon) → zooms to GPS WITHOUT moving marker
- [ ] "Fit Both Markers" button (diagonal arrows) → zooms to show both markers
- [ ] Fit Both Markers only visible when preview marker is shown
- [ ] Both buttons hidden when keyboard is visible

---

### SELECT MODE: Compact Mode (Keyboard Visible)

When the keyboard is showing, the UI enters compact mode to maximize search results space.

#### Compact Mode Layout
- [ ] Map height animates from 280px to 0px (fully collapsed)
- [ ] Animation duration: 250ms (iOS) or 150ms (Android)
- [ ] Map icon button appears in header to dismiss keyboard
- [ ] "Selected Location" card hidden in compact mode
- [ ] List items use smaller padding and font sizes
- [ ] Category/city info hidden on list items (only name + address)
- [ ] "Select" button hidden on items (tap to select when keyboard dismissed)
- [ ] Keyboard dismiss → auto-scrolls to selected item after layout settles

---

### SELECT MODE: Search Mode

Activated when user types in the search input.

#### Search Input
- [ ] Search box appears below map
- [ ] Placeholder text: "Search places..."
- [ ] Clear button (X) appears when text entered
- [ ] Clear button → clears search query and results

#### Search Behavior
- [ ] Minimum 2 characters required to trigger API search
- [ ] Search center point = blue marker position (not map center)
- [ ] Search radius = 50km from marker
- [ ] Yellow dashed circle shows on map indicating search area
- [ ] Loading indicator while fetching results
- [ ] When star button active (saved tab), search filters saved locations only (no API call)

#### Search Results List
- [ ] "Selected Location" card shown first (the blue marker point)
- [ ] "Selected Location" shows crosshairs icon in search mode (indicates search center)
- [ ] Search results displayed below with distance from marker
- [ ] Each result shows: name, address, category icon, distance
- [ ] Distance formatted per user's unit preference
- [ ] Clicking result → zooms map to that location
- [ ] Clicking result → shows red preview marker
- [ ] "Select" button appears on highlighted result
- [ ] Clicking "Select" → confirms selection, proceeds to create mode

---

### SELECT MODE: Nearby/Saved Tab

Toggle between nearby POIs and saved locations.

#### Tab Toggle
- [ ] Star icon button toggles between Nearby and Saved tabs
- [ ] Badge shows count of nearby saved locations
- [ ] Active tab shows filled star with accent color background
- [ ] Inactive tab shows outline star with secondary background

#### Nearby Tab (Default)
- [ ] Shows POIs from Foursquare within dynamic radius
- [ ] Radius adjusts based on map zoom level (500m to 10km)
- [ ] Nearby requests lock when preview marker shown (prevents reload on pan)
- [ ] "Selected Location" card shown first
- [ ] Tapped Google POI shown second (if any, with "From map" label)
- [ ] POIs shown with gray pin icon
- [ ] Distance shown for each POI (using user's unit preference)
- [ ] Duplicate detection: filters POIs that match saved locations

#### Saved Tab
- [ ] Shows user's saved locations within 10 miles of marker
- [ ] Saved locations shown with yellow star icon
- [ ] Entry count badge shows how many entries use each location
- [ ] When searching: shows ALL saved locations matching query (not distance filtered)
- [ ] Distance shown for each saved location (using user's unit preference)

#### List Item Interactions
- [ ] Tap item once → zoom to street level (0.005 delta, ~500m view)
- [ ] Tap item twice → zoom to city level (0.05 delta, ~5km view)
- [ ] Tap item three times → zoom to state level (2.0 delta, ~200km view)
- [ ] Tap cycles through zoom levels on repeated clicks
- [ ] Red preview marker (accentSecondary) appears at clicked location
- [ ] Preview marker callout auto-shows after 300ms
- [ ] "Select" button appears on highlighted item
- [ ] Highlighted item shows accentSecondary border
- [ ] Clicking "Select" on saved location → immediately returns location (no create mode)
- [ ] Clicking "Select" on POI → sets quickSelectMode, proceeds to create mode

#### Selected Location Card
- [ ] Always shown at top of list (hidden in compact mode)
- [ ] Shows current marker position with address or coordinates
- [ ] Icon: map pin (normal) or crosshairs (search mode)
- [ ] Shows user-given name if exists, else "Search Center" (searching) or "Current Point"
- [ ] Address displayed hierarchically (line1: street, line2: city/state/zip)
- [ ] Tapping → highlights card with accent border, zooms map to marker
- [ ] "Create" button appears when highlighted
- [ ] Clicking "Create" → proceeds to create mode with current marker

#### Icon States
- [ ] Saved location (not selected): Yellow star in light yellow bg
- [ ] Saved location (selected): accentSecondary pin in accentSecondary bg
- [ ] POI (not selected): Gray pin in secondary bg
- [ ] POI (selected): accentSecondary pin in accentSecondary bg

---

### CREATE MODE

Shown after selecting a location, before saving.

#### Name Input Card
- [ ] Card with "NAME" label
- [ ] Input placeholder: "Enter location name..."
- [ ] Text input for location name
- [ ] Name is optional (can save without name as "dropped pin")

#### Location Info Card
- [ ] Shows reverse-geocoded address data
- [ ] Address displayed hierarchically (street, city, state, zip, country)
- [ ] Coordinates shown at bottom with target icon

#### Address Actions
- [ ] **Display mode** (when address exists from geocoding):
  - [ ] "Edit Address" link in top-right
  - [ ] Clicking → switches to address editing mode
- [ ] **Edit mode** (when address cleared or no address):
  - [ ] "ADDRESS" label with "Lookup Address" link
  - [ ] Text input for custom address
  - [ ] Placeholder: "Street address, area name, etc."
  - [ ] "Lookup Address" triggers reverse geocoding
  - [ ] "Lookup Address" disabled while loading (grayed out, not spinner)

#### Precision Picker
- [ ] Dropdown button next to coordinates showing current precision
- [ ] Displays imperial or metric labels based on unit setting
- [ ] Tapping opens modal with precision options:
  - [ ] Exact (6 decimal places)
  - [ ] ~30 ft / ~10 m (4 decimals, "Building level")
  - [ ] ~300 ft / ~100 m (3 decimals, "Block level")
  - [ ] ~1600 ft / ~500 m (2 decimals, "Neighborhood")
  - [ ] ~0.6 mi / ~1 km (2 decimals, "District")
  - [ ] ~1 mi / ~1.5 km (2 decimals, "Area level")
- [ ] Selected option shows checkmark
- [ ] Selecting precision:
  - [ ] Rounds coordinates to specified decimal places
  - [ ] Sets accuracy field to precision radius
  - [ ] Shows precision circle on map
  - [ ] Zooms map to show precision area
- [ ] Coordinates display updates to show rounded values

#### Save Actions
- [ ] **With name entered:** "Save Location" button (save icon)
  - [ ] Creates location_id in database
  - [ ] Saves to My Places
  - [ ] Returns location with ID to parent
- [ ] **Without name:** "Save as Dropped Pin" button (crosshairs icon)
  - [ ] Does NOT create location_id
  - [ ] Returns location without ID (dropped pin)
  - [ ] Preserves address data and precision

#### Helper Text
- [ ] With name: "Location will be saved to My Places"
- [ ] Without name: "Enter a name to save to My Places"

#### Change Location
- [ ] "Change Location" action row with pin icon and chevron
- [ ] Clicking → returns to select mode
- [ ] Clears precision circle when going back

---

### VIEW MODE: Display

Shown when viewing an existing entry's location.

#### Location Card (Hero Display)
- [ ] Tappable card with horizontal layout (icon left, data right)
- [ ] Icon distinguishes type:
  - Saved location: Map pin icon (accent fill)
  - Dropped pin: Crosshairs icon (accent stroke)
- [ ] Icon container uses `accentLight` background
- [ ] Name displayed (or "Dropped Pin" for unnamed)
- [ ] Full address displayed hierarchically:
  - [ ] Address line (street or neighborhood)
  - [ ] City, State ZIP (state abbreviated when city present)
  - [ ] Region only line (full state name when no city)
  - [ ] Country
- [ ] Coordinates shown for all locations with target icon
- [ ] Accuracy shown inline with coordinates: "(±X ft)" or "(±X m)"
- [ ] Entry count badge shows usage count
- [ ] Zoom level indicator in upper right (magnifying glass + "±")

#### Location Card Interactions
- [ ] Tap card → cycles through zoom levels:
  - [ ] First tap: city level (0.05 delta)
  - [ ] Second tap: street level (0.005 delta)
  - [ ] Third tap: state level (2.0 delta)
  - [ ] Cycles back to city

#### GPS Info Display
- [ ] Accuracy shown inline with coordinates when available
- [ ] Snap distance displayed if location was moved from GPS
- [ ] All distances use user's unit preference

#### Action Buttons
- [ ] **Edit Location** (saved locations only)
  - [ ] Pencil icon with "Edit Location" text
  - [ ] Only shown if has location_id
  - [ ] Switches to inline edit mode
- [ ] **Change Location**
  - [ ] Pin icon with "Change Location" text
  - [ ] Switches to select mode
  - [ ] Clears location name so card shows "Current Point"
- [ ] **Clear Location** (red text)
  - [ ] X icon with "Clear Location" text
  - [ ] Removes ALL location data from entry
  - [ ] Returns null to parent

---

### VIEW MODE: Edit State

Inline editing of saved location.

#### Name Editing
- [ ] Name input card appears (auto-focused)
- [ ] Clear button (X circle) to remove name
- [ ] Clearing name → converts to dropped pin on save

#### Address Editing
- [ ] "Clear Address" link when address exists
- [ ] "Lookup Address" link when address cleared
- [ ] Lookup disabled while loading (grayed text)

#### Entry Count Warning
- [ ] Info icon with accent color when location used by multiple entries
- [ ] Text: "Changes will update X entries"
- [ ] Warns user before making changes

#### Cancel Action
- [ ] "Cancel" action row with back arrow icon and chevron
- [ ] Discards changes, returns to view mode

#### Save Button
- [ ] **With name:** "Save Changes" button (save icon)
  - [ ] Updates location name in database
  - [ ] Updates all entries using this location
  - [ ] Propagates update to parent form
- [ ] **Without name:** "Save Pin" button (crosshairs icon)
  - [ ] Converts to dropped pin (unlinks from saved location)
  - [ ] Keeps geo data, removes location_id

#### Helper Text
- [ ] With name: "Changes will update all entries using this location"
- [ ] Without name: "Clear name to convert to a dropped pin"

---

## Map Visual Elements

| Element | Color Source | When Shown |
|---------|-------------|------------|
| Selected marker | `functional.accent` | Always in select/create mode |
| Preview marker | `functional.accentSecondary` | When list item clicked |
| GPS accuracy circle | `functional.accent` @ 15%/40% | When GPS data exists, precision not set |
| Precision circle | `functional.accent` @ 20%/100% | When precision level selected |
| Search radius circle | `#FFCC00` (yellow) dashed | When search query >= 2 chars |
| User location dot | Native blue | Always (showsUserLocation) |

---

## "My Location" Button Behavior

The button behavior differs by mode to provide contextually appropriate actions:

| Mode | Icon | Behavior |
|------|------|----------|
| View | Navigation arrow | Fits map to show BOTH user location + pin |
| Create | Crosshairs | Recenters map on selected point |
| Select | Crosshairs | Zooms to GPS WITHOUT moving marker |

- [ ] View mode: Gets GPS, calculates center between user and marker, fits both
- [ ] Create mode: Animates back to marker position (recenter)
- [ ] Select mode: Zooms to GPS location, preserves marker/search center

---

## Keyboard Behavior

- [ ] Keyboard show → map height animates from 280px to 0px
- [ ] Keyboard hide → map height animates back to 280px
- [ ] Animation uses `useNativeDriver: false` (height animation)
- [ ] iOS uses keyboardWillShow/Hide, Android uses keyboardDidShow/Hide
- [ ] Map pan → dismisses keyboard via onPanDrag
- [ ] Scroll list → keeps keyboard (keyboardShouldPersistTaps="handled")
- [ ] Tap list item → dismisses keyboard first, then processes tap
- [ ] Map icon in header → dismisses keyboard, restores map

---

## Animation & UX Details

- [ ] Modal opens with spring animation from bottom (tension: 65, friction: 11)
- [ ] Backdrop fades in over 250ms
- [ ] Close animation: 250ms slide down + fade
- [ ] Map zoom uses 300ms animation (animateToRegion)
- [ ] Preview marker callout shows after 300ms delay
- [ ] Sheet dismisses on swipe down (>100px or velocity >0.5)
- [ ] Swipe snap-back uses spring (tension: 100, friction: 10)
- [ ] Keyboard-dismissed scroll uses 100ms delay for layout settling

---

## Duplicate Detection

The merged POI list has sophisticated deduplication:

**Exact Match (Full Key):**
- Name + Address match with saved location → Filter POI

**Proximity Match:**
- POI name matches saved location AND within 91m (300 feet) → Filter POI
- Allows different branches of chains to show separately

**Google POI Duplicate:**
- POI name matches tapped Google POI name → Filter from Foursquare results

---

## Test Scenarios (User Journeys)

### Journey 1: Search and Select POI
1. Open picker → GPS fetches, map centers
2. Type "coffee" in search → results appear, yellow radius circle shows
3. Tap "Starbucks" → map zooms, red preview marker shows
4. Tap "Select" → create mode opens
5. Enter name "Morning Coffee" → tap "Save Location"
6. Location saved to My Places, returned to entry

### Journey 2: Browse Nearby and Select
1. Open picker → nearby POIs load
2. Tap restaurant in list → map zooms street level, red marker
3. Tap same item again → zooms city level
4. Tap third time → zooms state level
5. Tap "Select" → create mode opens
6. Leave name empty → tap "Save as Dropped Pin"
7. Dropped pin returned (no location_id)

### Journey 3: Select Saved Location
1. Open picker → tap star toggle → saved tab
2. See saved locations with entry counts and yellow stars
3. Tap "Home" → map zooms, red preview marker
4. Tap "Select" → immediately returns saved location (skips create mode)

### Journey 4: Drop Pin on Map
1. Open picker → dismiss keyboard
2. Tap on map → marker moves, reverse geocoding starts
3. Auto-switches to create mode
4. Address populates after geocoding
5. Type "Secret Spot" → "Save Location" button
6. Save → creates location_id, returns to entry

### Journey 5: View and Edit Existing
1. Open in view mode → location card displays
2. Tap card → cycles zoom levels (city → street → state)
3. Tap "Edit Location" → name input appears
4. Change name → warning shows if multiple entries
5. Tap "Save Changes" → all entries updated

### Journey 6: Change Location from View
1. Open in view mode with existing location
2. Tap "Change Location" → switches to select mode
3. Card shows "Current Point" (name cleared)
4. Search or browse for new location
5. Select new location → replaces old one

### Journey 7: Clear Location
1. Open in view mode with existing location
2. Tap "Clear Location" (red)
3. All location data removed
4. Returns null to parent

### Journey 8: Search with Keyboard (Compact Mode)
1. Open picker → tap search box → keyboard shows
2. Map collapses to 0px → list expands
3. Type search query → results show in compact layout
4. Tap result → keyboard dismisses, map restores
5. List auto-scrolls to selected item
6. See preview marker and "Select" button

### Journey 9: Precision Selection
1. Open picker → select a location → create mode
2. Tap precision dropdown (shows "Exact")
3. Select "~300 ft" → coordinates round, circle shows on map
4. Map zooms to show precision area
5. Save → accuracy field saved with location

### Journey 10: Units Verification
1. Set units to Imperial in settings
2. Open picker → distances show in miles/feet
3. GPS accuracy shows "±X ft"
4. Precision picker shows "~30 ft", "~300 ft", etc.
5. Switch to Metric → shows km/m and metric labels

---

## Edge Cases & Known Behaviors

### Address Enrichment
- Reverse geocoding preserves existing address if Mapbox returns empty
- Useful for locations with tile data (e.g., "Missouri River")
- parseMapboxHierarchy filters features >500ft from query point

### GPS vs Manual Placement
- GPS accuracy circle only shown for GPS-derived positions
- Tapping map does NOT clear gpsAccuracy (dropped pins inherit GPS accuracy)
- Setting precision clears GPS accuracy circle (shows precision circle instead)

### Quick Select Mode
- POI selection with `quickSelectMode` flag auto-completes after enrichment
- No extra tap needed after geocoding finishes
- Location returned immediately with full data

### Location ID Tracking
- New locations get location_id when saved with name
- Dropped pins have no location_id
- Editing saved location updates all entries using it
- Clearing name converts saved location to dropped pin

### Request Locking
- Nearby POI requests lock when preview marker shown
- Prevents list from reloading while user evaluates selection
- Unlocks when preview marker cleared

### State Abbreviation Rules
- State abbreviated when city is present ("Kansas City, MO")
- Full state name when no city ("Missouri")

### Create Mode Address Editing
- User can clear geocoded address to enter custom text
- Custom address becomes location's address field
- "Lookup Address" re-triggers geocoding to restore
- If no name entered but custom address exists, address becomes name

---

## Version History

| Date | Change |
|------|--------|
| 2025-01-17 | Initial documentation created |
| 2025-01-17 | Added: Theme system, units system, precision picker, compact mode, address editing, detailed button behaviors |

