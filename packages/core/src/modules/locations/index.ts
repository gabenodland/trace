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

// API Configuration
export { configureLocationAPI, reverseGeocode } from './locationApi';

// Helpers for parsing geocode responses
export { parseMapboxHierarchy } from './locationHelpers';
