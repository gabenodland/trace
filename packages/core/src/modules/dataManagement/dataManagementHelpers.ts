// Pure helper functions for data management

import type { StorageWarningLevel } from "./DataManagementTypes";

// ============================================================================
// BYTE FORMATTING
// ============================================================================

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Format a byte count into a human-readable string.
 * Uses base-1024 (binary) units: 1 KB = 1024 bytes.
 *
 * @param bytes - Raw byte count
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string like "142.3 MB" or "1.8 GB"
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, UNITS.length - 1);
  const value = bytes / Math.pow(k, unitIndex);

  // Show integers when there's no fractional part
  const formatted = value % 1 === 0
    ? value.toFixed(0)
    : value.toFixed(decimals);

  return `${formatted} ${UNITS[unitIndex]}`;
}

/**
 * Convert megabytes to bytes.
 */
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

/**
 * Convert bytes to megabytes.
 */
export function bytesToMb(bytes: number): number {
  return bytes / (1024 * 1024);
}

// ============================================================================
// STORAGE PERCENTAGE & WARNINGS
// ============================================================================

/**
 * Calculate storage usage as a percentage of the limit.
 *
 * @param usedBytes - Current usage in bytes
 * @param limitMb - Tier limit in megabytes
 * @returns Percentage (0-100+), clamped to 0 minimum
 */
export function getStoragePercentage(usedBytes: number, limitMb: number): number {
  if (limitMb <= 0) return 0;
  const limitBytes = mbToBytes(limitMb);
  return (usedBytes / limitBytes) * 100;
}

/** Thresholds for storage warning levels */
const WARNING_THRESHOLD = 80;
const CRITICAL_THRESHOLD = 90;

/**
 * Determine the warning level based on storage usage percentage.
 *
 * - normal: < 80%
 * - warning: 80-89%
 * - critical: 90-99%
 * - exceeded: >= 100%
 */
export function getStorageWarningLevel(usedBytes: number, limitMb: number): StorageWarningLevel {
  const pct = getStoragePercentage(usedBytes, limitMb);
  if (pct >= 100) return 'exceeded';
  if (pct >= CRITICAL_THRESHOLD) return 'critical';
  if (pct >= WARNING_THRESHOLD) return 'warning';
  return 'normal';
}

/**
 * Check if storage limit is reached (uploads should be blocked).
 */
export function isStorageLimitReached(usedBytes: number, limitMb: number): boolean {
  return getStorageWarningLevel(usedBytes, limitMb) === 'exceeded';
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format storage usage as "X MB of Y MB" or "X GB of Y GB".
 * Picks the unit based on the limit size for consistency.
 */
export function formatStorageUsage(usedBytes: number, limitMb: number): string {
  const limitBytes = mbToBytes(limitMb);
  return `${formatBytes(usedBytes)} of ${formatBytes(limitBytes)}`;
}
