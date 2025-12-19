/**
 * useEntryRealtime - Hook for subscribing to realtime updates on a single entry
 *
 * Use this hook in entry editor screens to receive live updates from other devices.
 * It automatically:
 * - Subscribes when the entry is mounted
 * - Unsubscribes when the entry is unmounted
 * - Shows a toast when another device updates the entry
 *
 * Usage:
 * ```tsx
 * function CaptureForm({ entryId }) {
 *   const { externalUpdate, clearExternalUpdate } = useEntryRealtime(entryId);
 *
 *   // externalUpdate will be set when another device updates the entry
 *   // The form should refresh to show the new data
 * }
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeService } from './realtimeService';
import { Entry } from '@trace/core';

export interface UseEntryRealtimeResult {
  /** Set when another device updates the entry, null otherwise */
  externalUpdate: Entry | null;
  /** Clear the external update flag (call after handling the update) */
  clearExternalUpdate: () => void;
  /** Whether currently subscribed to realtime updates */
  isSubscribed: boolean;
}

/**
 * Hook to subscribe to realtime updates for a single entry
 * @param entryId - The entry ID to subscribe to (null/undefined = no subscription)
 * @param options - Optional configuration
 */
export function useEntryRealtime(
  entryId: string | null | undefined,
  options?: {
    /** Whether to enable the subscription (default: true) */
    enabled?: boolean;
  }
): UseEntryRealtimeResult {
  const queryClient = useQueryClient();
  const [externalUpdate, setExternalUpdate] = useState<Entry | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const enabled = options?.enabled ?? true;

  // Track current entryId to handle changes
  const currentEntryIdRef = useRef<string | null | undefined>(entryId);

  // Clear external update flag
  const clearExternalUpdate = useCallback(() => {
    setExternalUpdate(null);
  }, []);

  // Handle external change callback
  const handleExternalChange = useCallback((entry: Entry) => {
    setExternalUpdate(entry);
  }, []);

  // Set up subscription
  useEffect(() => {
    // Don't subscribe if disabled or no entryId
    if (!enabled || !entryId) {
      setIsSubscribed(false);
      return;
    }

    // Set query client for cache invalidation
    realtimeService.setQueryClient(queryClient);

    // Set callback for external changes
    realtimeService.setOnExternalChangeCallback(handleExternalChange);

    // Subscribe to entry
    realtimeService.subscribeToEntry(entryId);
    setIsSubscribed(true);
    currentEntryIdRef.current = entryId;

    // Cleanup on unmount or entryId change
    return () => {
      if (currentEntryIdRef.current) {
        realtimeService.unsubscribeFromEntry(currentEntryIdRef.current);
        setIsSubscribed(false);
      }
      realtimeService.setOnExternalChangeCallback(null);
    };
  }, [entryId, enabled, queryClient, handleExternalChange]);

  // Handle entryId changes (if user navigates to different entry without unmounting)
  useEffect(() => {
    const prevEntryId = currentEntryIdRef.current;

    if (prevEntryId && prevEntryId !== entryId) {
      // Unsubscribe from old entry
      realtimeService.unsubscribeFromEntry(prevEntryId);
      // Clear any pending external update from old entry
      setExternalUpdate(null);
    }

    currentEntryIdRef.current = entryId;
  }, [entryId]);

  return {
    externalUpdate,
    clearExternalUpdate,
    isSubscribed,
  };
}
