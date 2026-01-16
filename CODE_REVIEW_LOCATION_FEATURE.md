# Code Review: Location Feature (Dropped Pins & Saved Locations)

## Overview
This review covers the recent changes to the Location feature, specifically the introduction of the "Dropped Pin" concept separate from "Saved Locations", and the associated UI/UX updates in the Mobile app.

**Scope:**
- Last commit (Tilequery support, Location Views)
- Uncommitted changes (EntryListItem, metadata logic, removal logic)

## Summary of Changes
The codebase successfully implements a robust dual-state model for locations:
1.  **Saved Locations**: Entities with a `location_id`, user-defined `name`, and coordinates. These are reusable.
2.  **Dropped Pins**: Entities with coordinates (and optional address/geocoded data) but **no** `location_id` and **no** user-defined `name`.

## Key Findings

### 1. Data Mode & Architecture (Verified)
-   **Core Logic**: The system correctly identifies "unnamed" locations. `getLocationLabel` in `locationHelpers.ts` serves as the single source of truth, gracefully falling back to "Unnamed Location" or hierarchy data (City/Region) when no user name is present.
-   **Tilequery Support**: The addition of `useTilequeryGeographicFeature` and `enrichLocationFromMapbox` ensures that locations in nature (rivers, oceans) where standard addresses fail are preserved, using Mapbox Tilequery data.
    -   *Crucial Fix*: The logic to preserve `location.address` if Mapbox returns null prevents valid tilequery names ("Missouri River") from being overwritten by empty API responses.

### 2. Mobile UI/UX Flow (Verified)
-   **Picker Modes**: The logic in `EntryScreen.tsx` correctly determines whether to open the picker in `view` or `select` mode based on the presence of *any* coordinate data, not just named locations.
    -   *Result*: Users can view/edit anonymous dropped pins seamlessly.
-   **Action Context**:
    -   **Create View**: Distinct buttons for "Save Location" (creates reusable ID) vs "Use Pin" (one-off coordinate) clarifies intent.
    -   **Current View**: Handles the "Dropped Pin" state by offering to "Save Pin" (name it) or "Clear Location".
    -   **Context Switching**: Clearing the name of a Saved Location triggers a "demotion" to a Dropped Pin, which is a sophisticated and intuitive pattern.

### 3. Visual Feedback (Verified)
-   **Icons**: Consistent use of the **Pin** icon for saved/named locations and the **Crosshairs** icon for dropped pins/coordinates across `EntryListItem`, `MetadataBar`, and `LocationPicker`.
-   **Badges**: The `EntryListItem` correctly differentiates visualization, giving users immediate context about the type of location attached.

### 4. Code Quality & Best Practices
-   **Separation of Concerns**: The logic is well-distributed. `useCaptureFormState` manages data integrity, `useLocationPicker` manages map/API interactions, and the Views (`Create`/`Current`) handle presentation.
-   **Hook Usage**: Good use of `useMemo` and `useCallback` to prevent unnecessary re-renders in the complex location picker.

## Sugestions (Minor)
-   **Terminology**: In `CurrentLocationView`, the action "Clear Location" removes all data (coordinates + metadata). This is correct behavior, but "Remove Pin" might be slightly more precise since "Location" can be ambiguous. However, given the context, "Clear Location" is acceptable.

## Conclusion
The implementation is solid. The "Dropped Pin" feature is fully supported from the database layer up to the UI, providing a flexible location experience that handles both specific saved places and ad-hoc geographic points.

**Status**: ✅ Approved
