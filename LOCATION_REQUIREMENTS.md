# Location Feature Requirements

**Status:** Iteration 3 - Validated via Location Builder Testing Tool
**Date:** 2025-01-15
**Expo Constraint:** Must work with Expo Go (no custom native builds)

---
NOTES: 




## Database Schema

### entries table (updates)

**Existing fields (already in schema):**
- `location_lat` (number) - Currently GPS coords → will become private GPS latitude
- `location_lng` (number) - Currently GPS coords → will become private GPS longitude
- `location_name` (string) - Currently basic name → will become current display name

**New fields to add:**
```sql
ALTER TABLE entries ADD COLUMN:
  -- Display coords (public, respects privacy level)
  location_latitude DECIMAL(10, 8) NULL,
  location_longitude DECIMAL(11, 8) NULL,

  -- Location name tracking
  location_name_original VARCHAR(255) NULL,     -- Original from API (readonly, for matching)
  location_name_source VARCHAR(20) NULL,        -- 'mapbox_poi', 'foursquare_poi', 'google_poi', 'user_custom'

  -- Location hierarchy from Mapbox/Foursquare (API-only, never user-editable)
  location_neighborhood VARCHAR(100) NULL,
  location_postal_code VARCHAR(20) NULL,
  location_city VARCHAR(100) NULL,
  location_subdivision VARCHAR(100) NULL,       -- county
  location_region VARCHAR(100) NULL,            -- state/province
  location_country VARCHAR(100) NULL,

  -- Precision level selected by user
  location_precision VARCHAR(20) NULL,          -- 'coords', 'poi', 'address', 'neighborhood', 'city', 'region', 'country'

  -- API identifiers for deduplication
  location_mapbox_place_id VARCHAR(100) NULL,   -- Mapbox place ID
  location_foursquare_fsq_id VARCHAR(100) NULL, -- Foursquare FSQ ID

  -- Full API response (for future features)
  location_mapbox_json JSONB NULL;
```

**Field mapping:**
- `location_lat` → GPS coords (private, exact capture, never changes)
- `location_lng` → GPS coords (private, exact capture, never changes)
- `location_latitude` → Display coords (public, changes with precision)
- `location_longitude` → Display coords (public, changes with precision)
- `location_name` → Current display name (user-editable)

**No separate saved_locations table** - All location data stored directly on entries

**Rationale:**
- Simpler schema (no joins)
- Faster queries (single table)
- No deduplication complexity
- Entry-centric data model (location is entry metadata)
- Storage cost negligible (~200 bytes per entry)

### GPS vs Location Coords

**Two coordinate sets for privacy + debugging:**

| Field | Purpose | Changes? | Visibility | Use Case |
|-------|---------|----------|-----------|----------|
| `location_lat`, `location_lng` | Exact capture | Never | Private (user only) | Debugging, personal records |
| `location_latitude`, `location_longitude` | Display coords | Yes (with precision) | Public (shown on map) | Map display, sharing |

**How they work together:**

1. **Entry created with GPS**
   - `location_lat` = 39.072595 (exact house)
   - `location_lng` = -94.570935
   - `location_latitude` = 39.072595 (initially same)
   - `location_longitude` = -94.570935
   - `location_precision` = 'coords'

2. **User adjusts precision to "neighborhood"**
   - `location_lat` = 39.072595 (unchanged)
   - `location_lng` = -94.570935 (unchanged)
   - `location_latitude` = 39.0720 (Hyde Park center from Mapbox)
   - `location_longitude` = -94.5700
   - `location_precision` = 'neighborhood'

3. **User adjusts precision to "city"**
   - `location_lat` = 39.072595 (unchanged)
   - `location_lng` = -94.570935 (unchanged)
   - `location_latitude` = 39.0997 (Kansas City center from Mapbox)
   - `location_longitude` = -94.5786
   - `location_precision` = 'city'

**Map display logic:**
```typescript
// Always use location coords for display (respects privacy)
const displayCoords = {
  lat: entry.location_latitude,
  lon: entry.location_longitude
};

// GPS coords only for debugging/user records (never shown publicly)
const privateCoords = {
  lat: entry.location_lat,
  lon: entry.location_lng
};
```

### Location Name Tracking

**Three-field system prevents duplicates while allowing customization:**

| Scenario | location_name | location_name_original | location_name_source |
|----------|--------------|------------------------|---------------------|
| Foursquare POI | "Starbucks" | "Starbucks" | foursquare_poi |
| User edits POI | "Starbucks Downtown" | "Starbucks" | foursquare_poi |
| Google Maps POI | "Central Park" | "Central Park" | google_poi |
| GPS only (no POI) | NULL | NULL | NULL |
| User adds custom | "My Work" | NULL | user_custom |

**Benefits:**
- Know if name was edited: `location_name != location_name_original`
- Match by original API name (prevents duplicates from user edits)
- Show source in UI (🏢 Foursquare, 📍 Google, ✏️ Custom)

**UI Rule:** Hierarchy fields (city/region/country) are API-only, never user-editable

---

## API Stack (Validated via Testing Tool)

### 1. Google Maps POI Markers (FREE)
- **Library:** `react-native-maps` with `onPoiClick`
- **Expo Compatible:** Yes (built-in)
- **Cost:** $0 (client-side, no API calls)
- **Returns:** `name`, `placeId`, `coordinate`
- **Use Case:** User taps visible POI on map

### 2. Mapbox Geocoding API
- **Endpoint:** `https://api.mapbox.com/geocoding/v5/mapbox.places/{lon},{lat}.json`
- **Expo Compatible:** Yes (HTTP only)
- **Free Tier:** 100,000 requests/month
- **Returns:** Full hierarchy (country → region → city → neighborhood → address → POI)
- **Use Case:** GPS → address conversion (automatic on entry creation)
- **Caching:** 30 days, global (shared across users)

### 3. Foursquare Places - Nearby Search
- **Endpoint:** `https://places-api.foursquare.com/places/search`
- **Expo Compatible:** Yes (HTTP only)
- **Free Tier:** 100,000 requests/day
- **Optimal Params:** `radius=500m`, `limit=50`, `sort=DISTANCE`
- **Returns:** Top 25 POI sorted by distance
- **Use Case:** "What's near me?" discovery
- **Caching:** 7 days, per-user

### 4. Foursquare Autocomplete
- **Endpoint:** `https://places-api.foursquare.com/autocomplete`
- **Expo Compatible:** Yes (HTTP only)
- **Free Tier:** 100,000 requests/day (shared with nearby)
- **Optimal Params:** `query={text}`, `radius=50000m`, `limit=10`
- **Returns:** Business search results
- **Use Case:** "Find Starbucks on Main Street"
- **Debouncing:** 300ms

**Security:** API keys in `.env` (gitignored), client-side for MVP, move to Supabase Edge Functions at 1k users

---

## Entry Creation Flow

### 1. GPS Capture (Background)
- Capture GPS when entry created (if enabled - existing setting)
- Store exact coords:
  - `location_lat` = captured latitude (private, never changes)
  - `location_lng` = captured longitude (private, never changes)
  - `location_latitude` = same as GPS (initially)
  - `location_longitude` = same as GPS (initially)

### 2. Reverse Geocoding (Automatic)
- Call Mapbox geocoding API with GPS coords
- Store all hierarchy fields from Mapbox response
- Populate location coords at each precision level (for slider):
  - Coords level: use GPS coords
  - Address level: use address center from Mapbox
  - Neighborhood level: use neighborhood center from Mapbox
  - City level: use city center from Mapbox
  - (Store in `location_mapbox_json` for precision slider)
- If Mapbox returns POI name:
  - `location_name` = Mapbox POI name
  - `location_name_original` = Mapbox POI name
  - `location_name_source` = 'mapbox_poi'
  - `location_mapbox_place_id` = Mapbox place ID
- If no POI name (just address):
  - `location_name` = NULL (user can add custom name later)
  - `location_name_original` = NULL
  - `location_name_source` = NULL
- Default `location_precision = 'coords'` (most precise)
- Cache Mapbox response globally (30 days)

### 3. Location Selector (User-Initiated)

**Three Options:**

**Option A: Tap Map POI**
- User taps Google Maps POI marker
- Returns: `name`, `placeId`, `coordinate`
- Reverse geocode coordinate → get hierarchy from Mapbox
- Store:
  - `location_name` = POI name
  - `location_name_original` = POI name
  - `location_name_source` = 'google_poi'
  - `location_mapbox_place_id` = from reverse geocode
  - All hierarchy fields from Mapbox
  - `location_precision` = 'poi'

**Option B: Nearby Discovery (Top 25)**
- User clicks "Nearby" button
- Fetch Foursquare nearby (500m, 50 results, sort by distance)
- Display top 25 in list
- User selects → store:
  - `location_name` = Foursquare name
  - `location_name_original` = Foursquare name
  - `location_name_source` = 'foursquare_poi'
  - `location_foursquare_fsq_id` = Foursquare FSQ ID
  - All hierarchy fields from Foursquare response
  - `location_precision` = 'poi'

**Option C: Search by Name**
- User types in search box (300ms debounce)
- Fetch Foursquare autocomplete
- User selects → store:
  - `location_name` = Foursquare name
  - `location_name_original` = Foursquare name
  - `location_name_source` = 'foursquare_poi'
  - `location_foursquare_fsq_id` = Foursquare FSQ ID
  - All hierarchy fields from Foursquare response
  - `location_precision` = 'poi'

### 4. Precision Slider (Post-Selection)
- Vertical slider with 7 levels:
  1. Coords (exact GPS)
  2. POI (business name)
  3. Address (street address)
  4. Neighborhood
  5. City
  6. Region (state)
  7. Country
- User adjusts slider → updates `location_precision`
- Renders location at selected precision level (hides more precise data)

---

## Location Snapping

**When:** Entry created with GPS

**Logic:**
1. Query past entries within 100m of new **GPS coords** (not location coords)
2. Match by:
   - Same `location_foursquare_fsq_id` (exact POI match) OR
   - Same `location_name_original` (same API-sourced name) OR
   - Same `location_city` + high usage (fallback for custom names)
3. If match found AND used 2+ times → suggest snapping
4. User accepts → copy ALL location fields (name, hierarchy, IDs, location coords)

**Use Case:** Auto-tag "Home", "Work", or "Starbucks" after a few visits

**Why GPS coords for distance:** We want to match "have I physically been HERE before" not "is this the same privacy zone"

**Implementation:**
```sql
-- Priority 1: Exact POI match by FSQ ID
SELECT location_name, location_city, location_foursquare_fsq_id, COUNT(*) as usage
FROM entries
WHERE user_id = $1
  AND location_lat IS NOT NULL
  AND location_foursquare_fsq_id IS NOT NULL
  AND location_foursquare_fsq_id = $4  -- From new entry's POI selection
GROUP BY location_name, location_city, location_foursquare_fsq_id
HAVING COUNT(*) >= 2

UNION

-- Priority 2: Distance + original name match (using GPS coords for distance)
SELECT location_name, location_city, location_name_original, COUNT(*) as usage
FROM entries
WHERE user_id = $1
  AND location_lat IS NOT NULL
  AND (
    6371000 * acos(
      cos(radians($2)) * cos(radians(location_lat)) *
      cos(radians(location_lng) - radians($3)) +
      sin(radians($2)) * sin(radians(location_lat))
    )
  ) <= 100
GROUP BY location_name, location_city, location_name_original
HAVING COUNT(*) >= 2

ORDER BY usage DESC
LIMIT 1
```

**Example:**
- User visits Starbucks 3 times at GPS (39.0725, -94.5709)
- Sets precision to "city" on 2nd visit → location coords change to city center
- 4th visit: GPS captures same coords → matches by GPS distance (not location coords)
- Suggests: "Starbucks (3 previous visits)" → copies location fields from most recent

---

## Privacy Controls

**Precision Level Selection (Primary Privacy Method):**
- User adjusts slider from 'coords' (exact) to 'city' (generic)
- `location_lat`/`location_lng` = unchanged (private, never shared)
- `location_latitude`/`location_longitude` = updated to less precise coords from Mapbox
- Map displays location coords (privacy protected)

**Per-Entry GPS Clearing (Complete Privacy):**
- User can delete `location_lat`, `location_lng` from entry
- `location_latitude`/`location_longitude` remain (from last precision level)
- Entry shows on map at last selected precision level
- Original capture permanently deleted (cannot be recovered)

**Privacy Levels:**
1. **Full precision** (`coords`) → location coords = GPS coords (exact)
2. **POI/Address** (`poi`/`address`) → location coords = POI/address center
3. **Neighborhood** → location coords = neighborhood center from Mapbox
4. **City** → location coords = city center from Mapbox
5. **GPS deleted** → location coords remain, GPS coords = NULL (ultimate privacy)

---

## Map View Screen

**Layout:**
- Top: `react-native-maps` MapView (200-300px height)
- Bottom: Entry list (filtered to visible map region)

**Clustering:**
- `react-native-clusterer` (pure JS, Expo compatible)
- Cluster markers when zoomed out
- Tap cluster → zoom in
- Tap marker → open entry

**Filtering:**
- Zoom/pan map → update entry list to show only entries in visible region
- Date/category filters: NOT in MVP

**Offline Mode:**
- Show entry list grouped by location hierarchy
- No map tiles (require network)

---

## Location Picker UI

**Autocomplete with Recency Priority:**
- Search box at top (300ms debounce)
- Results sorted by:
  1. Exact name match
  2. Usage count (DESC)
  3. Last used (DESC)
  4. Alphabetical

**No entry counts in MVP** (future: show "(47 entries)")

---

## Partial Hierarchy Handling

**If Mapbox returns incomplete data:**
- Store whatever fields Mapbox returns
- Allow user to add `location_name` manually
- Do NOT allow manual editing of country/region/city (keep data consistent)
- Exception: Remote areas with no hierarchy can be fully custom

---

## Tech Stack Summary

| Component | Library | Expo Compatible | Cost |
|-----------|---------|-----------------|------|
| Map Display | `react-native-maps` | ✅ Yes | $0 |
| GPS Capture | `expo-location` | ✅ Yes | $0 |
| Clustering | `react-native-clusterer` | ✅ Yes | $0 |
| Geocoding | Mapbox API | ✅ Yes (HTTP) | $0 (100k/mo free) |
| POI Discovery | Foursquare API | ✅ Yes (HTTP) | $0 (100k/day free) |
| POI Search | Foursquare Autocomplete | ✅ Yes (HTTP) | $0 (100k/day free) |

**Total Cost:** $0/month for first 5,000 users (with caching)

---

## Open Questions

**Q1:** Should users be able to edit location hierarchy fields (city, region, country) manually?
**Current Answer:** No - keep API-sourced data consistent. Only `location_name` is user-editable. although entries can be made more generic by removing more specific levels, and remapping the location gps to that less specific data

**Q2:** Should we create location "favorites" or "saved locations" later?
**Current Answer:** Defer to post-MVP. Snapping to past locations provides similar functionality.

---

## Implementation Phases

**Timeline:** MOBILE FIRST, then web
**Architecture:** Maximum logic in @trace/core (shared), minimal platform-specific code

### Phase 1: Database & Core Logic
- Add new columns to entries table (migration)
- Core location types (@trace/core)
- Mapbox reverse geocoding API wrapper (core)
- Foursquare nearby + autocomplete wrappers (core)
- Location helpers (distance calc, hierarchy grouping) (core)
- Global cache logic (core)

### Phase 2: Mobile - Location Picker Dropdown
**Entry screen location button** (replaces GPS toggle):
- Button labeled "Location" opens dropdown control
- Dropdown expands to bottom of page
- Three tabs at top: "Map" | "Search" | "Custom"

**Map Tab:**
- MapView at top (200px)
- Nearby POI list at bottom (scrollable)
- Fetch Foursquare nearby (500m) on open
- Click map → requery with new coords
- Click Google POI marker → add to top of list
- Click POI in list → add to entry, close dropdown

**Search Tab:**
- No map
- Autocomplete search input (Foursquare autocomplete)
- Results list below
- Click result → add to entry, close dropdown

**Custom Tab:**
- MapView at top (200px)
- Text input at bottom: "Enter location name"
- User types custom name
- Map shows current GPS or user can tap to set
- Save → adds custom location to entry

### Phase 3: Mobile - Entry Creation Integration
- Auto-capture GPS in background
- Auto-populate hierarchy via Mapbox
- Location button shows current location name or "Add Location"
- Edit location reopens dropdown with current selection

### Phase 4: Mobile - Location Snapping
- Query past entries within 100m
- Show suggestion banner: "Use 'Home' (5 previous visits)?"
- One-tap to apply suggested location

### Phase 5: Mobile - Map View Screen
- New screen: LocationScreen (tab navigation)
- MapView with entry markers (top)
- Entry list filtered by visible region (bottom)
- Clustering with react-native-clusterer
- Offline: hierarchical location tree

### Phase 6: Mobile - Privacy & Settings
- Precision slider (7 levels) in location editor
- GPS clearing per entry
- Location management screen (view/edit/delete past locations)

### Phase 7: Web - Proof of Concept (After Mobile Complete)
- Basic location picker (simplified version)
- Map view screen
- Location display in entries

---

## Mobile UX: Location Picker Dropdown

### Entry Screen Integration
**Location Button** (replaces current GPS on/off toggle):
- Label: "Location" or current location name ("Starbucks", "Home", etc.)
- Icon: 📍 location pin
- Tap → opens location picker dropdown

### Dropdown Control Behavior
- Style: Dropdown control (same as category picker)
- Expands to bottom of page (full height below button)
- Overlay dims background
- Close: tap outside, select location, or cancel button

### Three Tabs (Top of Dropdown)
```
┌──────────────────────────────────┐
│ [Map]  [Search]  [Custom]        │
├──────────────────────────────────┤
│                                   │
│  (Tab content here)               │
│                                   │
└──────────────────────────────────┘
```

### Map Tab (Default)
```
┌──────────────────────────────────┐
│ ╔════════════════════════════╗   │
│ ║     MapView (200px)        ║   │
│ ║  [Shows current GPS]       ║   │
│ ║  [Google POI markers]      ║   │
│ ╚════════════════════════════╝   │
├──────────────────────────────────┤
│ Nearby Locations (scrollable)     │
│ ┌────────────────────────────┐   │
│ │ 📍 Starbucks (50m)         │   │
│ │ 📍 Central Park (120m)     │   │
│ │ 📍 Library (200m)          │   │
│ └────────────────────────────┘   │
└──────────────────────────────────┘
```

**Behavior:**
1. On open: fetch Foursquare nearby (500m, 25 results)
2. Display sorted by distance
3. User taps map → GPS updates → requery nearby
4. User taps Google POI marker → POI jumps to top of list
5. User taps POI in list → add to entry, close dropdown

### Search Tab
```
┌──────────────────────────────────┐
│ ┌────────────────────────────┐   │
│ │ 🔍 Search for a place...   │   │
│ └────────────────────────────┘   │
├──────────────────────────────────┤
│ Search Results (scrollable)       │
│ ┌────────────────────────────┐   │
│ │ Starbucks - Main St        │   │
│ │ Starbucks - Downtown       │   │
│ │ Starbucks - Plaza          │   │
│ └────────────────────────────┘   │
└──────────────────────────────────┘
```

**Behavior:**
1. No map visible
2. User types → Foursquare autocomplete (300ms debounce)
3. Results list updates
4. User taps result → add to entry, close dropdown

### Custom Tab
```
┌──────────────────────────────────┐
│ ╔════════════════════════════╗   │
│ ║     MapView (200px)        ║   │
│ ║  [Tap to set location]     ║   │
│ ╚════════════════════════════╝   │
├──────────────────────────────────┤
│ ┌────────────────────────────┐   │
│ │ Enter location name...     │   │
│ └────────────────────────────┘   │
│                                   │
│         [Save]  [Cancel]          │
└──────────────────────────────────┘
```

**Behavior:**
1. Map shows current GPS or last tapped location
2. User can tap map to adjust coords
3. User types custom name in text box
4. Save → creates location with custom name + selected coords
5. Cancel → close without saving

### Data Flow
**Map Tab → Entry:**
- Foursquare POI selected → all hierarchy from Foursquare
- `location_name_source` = 'foursquare_poi'
- `location_foursquare_fsq_id` = FSQ ID

**Search Tab → Entry:**
- Foursquare autocomplete selected → all hierarchy from Foursquare
- `location_name_source` = 'foursquare_poi'
- `location_foursquare_fsq_id` = FSQ ID

**Custom Tab → Entry:**
- User-typed name + map coords
- Reverse geocode coords → get hierarchy from Mapbox
- `location_name` = user input
- `location_name_source` = 'user_custom'
- `location_name_original` = NULL

---

## Testing Tool: Location Builder

**Purpose:** Validate API behavior before production implementation

**Features:**
- Tab 1: Mapbox reverse geocoding tester
- Tab 2: Foursquare nearby search tester (radius tuning)
- Tab 3: Foursquare autocomplete tester (debouncing, keyboard UX)

**Key Findings:**
- 500m radius optimal for nearby (10km filters out child locations)
- Text search finds POI that location search misses
- Autocomplete uses different data structure (`place` wrapper)
- Debouncing (300ms) + map shrinking (150px) = good UX

**Location:** `apps/mobile/src/screens/LocationBuilderScreen.tsx` (developer tool, not in prod navigation)

---

## Cost Projections

| Users | Mapbox Calls | Foursquare Calls | Monthly Cost |
|-------|-------------|-----------------|--------------|
| 100 | 5,000 (cached) | 2,000 | $0 |
| 1,000 | 50,000 (cached) | 20,000 | $0 |
| 5,000 | 250,000 | 100,000 | $75 (Mapbox overage) |
| 10,000 | 500,000 | 200,000 | $200 (both APIs) |

**Mitigation:**
- Aggressive caching (30-day global for Mapbox, 7-day per-user for Foursquare)
- Move to Supabase Edge Functions proxy at 1k users (enables rate limiting)
- Consider Mapbox Enterprise pricing at 10k users

---

**Next Steps:**
1. Finalize database migration for entries table location fields
2. Implement Mapbox reverse geocoding wrapper
3. Build location selector modal (3 options)
4. Implement location snapping logic
5. Build map view screen with clustering

**Blockers:** None - all APIs tested and validated
