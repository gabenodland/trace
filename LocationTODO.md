# Location Feature TODO

## 1. Accuracy Circle on Map
**Screens:** CurrentLocationView, CreateLocationView

Show GPS accuracy circle on the map when:
- Viewing a dropped pin that has accuracy data stored
- Creating a new entry from GPS location (save the accuracy)

**Do NOT show circle when:**
- User manually taps a point on the map (accuracy = 0, exact position)

---

## 2. Dropped Pin Display - Show All Available Data
**Screen:** CurrentLocationView

Display location info hierarchically based on what data is available.
**Always show coordinates** for dropped pins (GPS-ish feel).

### With Address:
```
Address
City, State ZIP
39.123456, -94.123456
```

### Without Address (has neighborhood):
```
Neighborhood
City, State ZIP
39.123456, -94.123456
```

### Without Neighborhood:
```
City, State ZIP
39.123456, -94.123456
```

### Without City (state only):
```
California (full name, NOT abbreviated)
39.123456, -94.123456
```

**State abbreviation rule:** Use abbreviations (MO, CA) when city is shown. Use full name (Missouri, California) when state is the only geographic info.

---

## 3. Lookup Address UX Issues
**Screen:** CreateLocationView / Edit mode

### Issues:
1. **Keyboard focus jump** - Clicking "Lookup Address" steals focus from the Name TextInput, closes keyboard, then reopens it
2. **Auto-focus on open** - Name TextInput auto-focuses when CreateLocationView opens, which shows keyboard immediately
3. **Loading indicator** - Shows "Loading location details..." briefly which is jarring

### Desired behavior:
- Don't auto-focus the Name TextInput when CreateLocationView first opens (keep keyboard hidden)
- When "Lookup Address" is clicked, just gray out and disable the button while query runs (no spinner/loading text)
- Don't show "Loading location details..." for address lookup

---

## 4. Distinct Pin Colors for Map
**Screen:** LocationSelectView (map view)

### Current State
Both pins use `functional.accent` with different opacity:
- **Selected Location pin**: `functional.accent` (always visible)
- **Preview pin**: `functional.accent` @ 70% opacity (when list item tapped)

**Problem:** Same color makes it hard to distinguish selected vs preview.

### Solution: Add `functional.accentSecondary` to Theme

Add a new theme color for secondary accent use cases (like preview pins, alternative highlights).

**Theme type change:**
```typescript
functional: {
  complete: string;
  incomplete: string;
  overdue: string;
  accent: string;
  accentLight: string;
  accentSecondary: string;  // NEW - Secondary accent color
}
```

### Color Values by Theme

| Theme | `accent` | `accentSecondary` |
|-------|----------|-------------------|
| Light | Blue `#3B82F6` | Orange `#F59E0B` |
| Dark | Blue `#60A5FA` | Orange `#FB923C` |
| Sepia | Brown `#92400E` | Amber `#D97706` |
| Tech Green | Green `#39D353` | Orange `#F97316` |
| Modern | Blue `#3B82F6` | Orange `#F59E0B` |
| High Contrast | Blue `#2563EB` | Orange `#EA580C` |
| Synthwave Dark | Pink `#F472B6` | Cyan `#22D3EE` |
| Synthwave Light | Pink `#EC4899` | Cyan `#06B6D4` |

### Final Pin Color Scheme

| Pin | Theme Path | Use Case |
|-----|------------|----------|
| **Selected Location** | `functional.accent` | Always visible, primary selection |
| **Preview (highlighted)** | `functional.accentSecondary` | When list item tapped |

### Implementation

**Files to update:**
1. `ThemeTypes.ts` - Add `accentSecondary` to `functional` interface
2. `light.ts` - Add orange `#F59E0B`
3. `dark.ts` - Add orange `#FB923C`
4. `sepia.ts` - Add amber `#D97706`
5. `techGreen.ts` - Add orange `#F97316`
6. `modern.ts` - Add orange `#F59E0B`
7. `highContrast.ts` - Add orange `#EA580C`
8. `synthwaveDark.ts` - Add cyan `#22D3EE`
9. `synthwaveLight.ts` - Add cyan `#06B6D4`

**Code change in LocationPicker.tsx:**
```typescript
// Preview Marker - change from accent to accentSecondary
<Svg ... fill={dynamicTheme.colors.functional.accentSecondary}>
```

---

## 5. Fit Both Markers Button
**Screen:** LocationSelectView (map view)

### Problem
When user taps a POI/saved location from the list, the map zooms to that location. If the POI is far from the selected location, both markers can't be seen at once.

### Current Behavior
- **Selected Location marker**: Always visible (blue/accent pin)
- **Preview marker**: Shows when list item tapped, map zooms to it
- Tapping the POI marker again re-zooms to it

### Desired Behavior
Add a "Fit" button next to the existing "My Location" button on the map.

**Button visibility:**
- Hidden by default
- Shows when preview marker is visible AND it's far enough from selected location that both can't be seen

**Button action:**
- Tap → Fit map to show BOTH markers (selected + preview) with padding
- Uses `mapRef.fitToCoordinates([selectedCoords, previewCoords], { edgePadding: ... })`

**Interaction flow:**
1. User taps POI in list → map zooms to POI, fit button appears
2. User taps fit button → map zooms out to show both markers
3. User taps POI marker → map zooms back to POI (existing behavior)

### Implementation

**Icon:** Could use a "maximize" or "expand" icon, or two markers with arrows

**Location:** Below or above the existing "My Location" button

**Code location:** `LocationPicker.tsx` near the `mapLocationButton`