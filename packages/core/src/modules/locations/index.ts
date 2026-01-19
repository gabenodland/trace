/**
 * Locations Module - Public API
 *
 * Export hooks, types, and helpers for location/mapping features.
 * API layer is NOT exported (internal use only).
 */

// Hooks
export * from './locationHooks';

// Types
export * from './LocationTypes';

// Helpers (pure utility functions)
export { locationHelpers } from './locationHooks';
export { calculateDistance, formatDistance } from './locationHelpers';

// API (for internal use by hooks)
export { reverseGeocode } from './locationApi';

// Helpers for parsing geocode responses and location snapping
export { parseMapboxHierarchy, geocodeResponseToEntryFields, findNearbyLocation } from './locationHelpers';
export type { EntryLocationFields, LocationSnapResult } from './locationHelpers';

// Location label helper - single source of truth for display names
export { getLocationLabel, hasLocationLabel, getStateAbbreviation } from './locationHelpers';
export type { LocationLabelFields } from './locationHelpers';
