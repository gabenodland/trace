/**
 * Settings Helpers - Pure utility functions for settings-related operations
 *
 * All functions are pure (no side effects) and can be used anywhere.
 */

import type { UnitSystem } from './SettingsTypes';

// ============================================================================
// DISTANCE FORMATTING
// ============================================================================

/**
 * Format distance for display based on unit system
 *
 * Metric: meters (m) and kilometers (km)
 * Imperial: feet (ft) and miles (mi)
 */
export function formatDistanceWithUnits(meters: number, units: UnitSystem): string {
  // Handle invalid inputs
  if (typeof meters !== 'number' || isNaN(meters) || meters < 0) {
    return '—';
  }

  if (units === 'imperial') {
    // Convert to feet
    const feet = meters * 3.28084;

    // Use miles for distances >= 1000 feet (roughly 0.19 miles)
    if (feet >= 1000) {
      const miles = meters / 1609.34;
      return `${miles.toFixed(1)}mi`;
    }

    return `${Math.round(feet)}ft`;
  }

  // Metric (default)
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Format distance with full unit names (for accessibility or verbose display)
 */
export function formatDistanceVerbose(meters: number, units: UnitSystem): string {
  // Handle invalid inputs
  if (typeof meters !== 'number' || isNaN(meters) || meters < 0) {
    return 'Unknown distance';
  }

  if (units === 'imperial') {
    const feet = meters * 3.28084;

    if (feet >= 1000) {
      const miles = meters / 1609.34;
      const mileText = miles === 1 ? 'mile' : 'miles';
      return `${miles.toFixed(1)} ${mileText}`;
    }

    const footText = Math.round(feet) === 1 ? 'foot' : 'feet';
    return `${Math.round(feet)} ${footText}`;
  }

  // Metric
  if (meters < 1000) {
    const meterText = Math.round(meters) === 1 ? 'meter' : 'meters';
    return `${Math.round(meters)} ${meterText}`;
  }

  const km = meters / 1000;
  const kmText = km === 1 ? 'kilometer' : 'kilometers';
  return `${km.toFixed(1)} ${kmText}`;
}

// ============================================================================
// SETTINGS VALIDATION
// ============================================================================

/**
 * Validate and merge settings with defaults
 * Ensures all required fields exist even if storage is corrupted
 */
export function mergeWithDefaults<T extends object>(
  stored: Partial<T> | null | undefined,
  defaults: T
): T {
  if (!stored) {
    return { ...defaults };
  }

  return { ...defaults, ...stored };
}
