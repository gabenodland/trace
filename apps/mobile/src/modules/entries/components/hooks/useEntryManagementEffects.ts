/**
 * useEntryManagementEffects - Side effects for EntryManagementScreen
 *
 * Handles automatic effects that run when entry state changes:
 * - GPS Auto-Capture: Captures GPS for new entries when setting enabled
 * - Auto-Geocode: Reverse geocodes coordinates to get address
 * - Stream Templates: Applies title/content templates from stream config
 *
 * Uses props/refs pattern - all state passed as parameters, no Context.
 */

import { useEffect, useRef } from 'react';
import * as ExpoLocation from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import {
  reverseGeocode,
  geocodeResponseToEntryFields,
  findNearbyLocation,
  applyTitleTemplate,
  applyContentTemplate,
  combineTitleAndBody,
} from '@trace/core';
import type { LocationEntity, Stream } from '@trace/core';
import type { EntryWithRelations } from '../../EntryWithRelationsTypes';
import type { RichTextEditorV2Ref } from '../../../../components/editor/RichTextEditorV2';
import { createScopedLogger } from '../../../../shared/utils/logger';

const log = createScopedLogger('EntryEffects', '🔄');

export interface UseEntryManagementEffectsOptions {
  /** Current entry state */
  entry: EntryWithRelations | null;
  /** Entry setter function */
  setEntry: React.Dispatch<React.SetStateAction<EntryWithRelations | null>>;
  /** Original entry setter (for baseline updates on auto-capture) */
  setOriginalEntry: React.Dispatch<React.SetStateAction<EntryWithRelations | null>>;
  /** Whether this is a new (unsaved) entry */
  isNewEntry: boolean;
  /** Entry ID (for tracking ref resets) */
  entryId: string | null;
  /** User settings */
  settings: {
    captureGpsLocation: boolean;
  };
  /** Available streams */
  streams: Stream[];
  /** Saved locations for snapping */
  savedLocations: LocationEntity[];
  /** Editor ref for template content updates */
  editorRef: React.RefObject<RichTextEditorV2Ref | null>;
}

/**
 * Manages automatic side effects for EntryManagementScreen.
 * All state is passed in - no Context dependency.
 */
export function useEntryManagementEffects(options: UseEntryManagementEffectsOptions): void {
  const {
    entry,
    setEntry,
    setOriginalEntry,
    isNewEntry,
    entryId,
    settings,
    streams,
    savedLocations,
    editorRef,
  } = options;

  // =========================================================================
  // Tracking refs - prevent duplicate effect executions
  // =========================================================================

  // Track if GPS capture has been attempted for this entry session
  const hasAttemptedGpsCaptureRef = useRef(false);
  // Track if geocode has been attempted for current coordinates
  const lastGeocodedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  // Track if template has been applied for current stream
  const lastTemplateStreamIdRef = useRef<string | null>(null);

  // Reset tracking refs when entry changes
  useEffect(() => {
    hasAttemptedGpsCaptureRef.current = false;
    lastGeocodedCoordsRef.current = null;
    lastTemplateStreamIdRef.current = null;
  }, [entryId, isNewEntry]);

  // =========================================================================
  // GPS Auto-Capture
  // =========================================================================

  useEffect(() => {
    // Only for new entries
    if (!isNewEntry || !entry) return;
    // Only attempt once per entry session
    if (hasAttemptedGpsCaptureRef.current) return;
    // Skip if GPS capture setting is disabled
    if (!settings.captureGpsLocation) return;
    // Skip if entry already has location
    if (entry.entry_latitude != null || entry.entry_longitude != null) return;

    // Check if location is enabled for the current stream
    const currentStream = streams.find(s => s.stream_id === entry.stream_id);
    if (currentStream && !currentStream.entry_use_location) {
      log.debug('GPS capture skipped - location not enabled for stream');
      return;
    }

    hasAttemptedGpsCaptureRef.current = true;
    log.info('Auto-capturing GPS for new entry');

    (async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          log.warn('GPS permission not granted');
          return;
        }

        // Try cached location first for speed
        let location = await ExpoLocation.getLastKnownPositionAsync();
        if (!location) {
          location = await ExpoLocation.getCurrentPositionAsync({
            accuracy: ExpoLocation.Accuracy.Balanced,
          });
        }

        if (location) {
          log.info('GPS captured', { lat: location.coords.latitude, lng: location.coords.longitude });
          setEntry(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              entry_latitude: location.coords.latitude,
              entry_longitude: location.coords.longitude,
              location_radius: location.coords.accuracy ?? null,
            };
          });
          // Also update originalEntry so this doesn't mark as dirty
          setOriginalEntry(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              entry_latitude: location.coords.latitude,
              entry_longitude: location.coords.longitude,
              location_radius: location.coords.accuracy ?? null,
            };
          });
        }
      } catch (err) {
        log.error('GPS capture failed', err);
      }
    })();
  }, [isNewEntry, entry, settings.captureGpsLocation, streams, setEntry, setOriginalEntry]);

  // =========================================================================
  // Auto-Geocode
  // =========================================================================

  useEffect(() => {
    if (!entry) return;
    // Skip if no coordinates
    if (entry.entry_latitude == null || entry.entry_longitude == null) return;
    // Skip if already has address data
    if (entry.city || entry.region || entry.country) return;
    // Skip if we already geocoded these coordinates
    const lat = entry.entry_latitude;
    const lng = entry.entry_longitude;
    if (lastGeocodedCoordsRef.current &&
        Math.abs(lastGeocodedCoordsRef.current.lat - lat) < 0.00001 &&
        Math.abs(lastGeocodedCoordsRef.current.lng - lng) < 0.00001) {
      return;
    }

    lastGeocodedCoordsRef.current = { lat, lng };
    log.debug('Auto-geocoding coordinates', { lat, lng });

    (async () => {
      try {
        // First try to snap to a saved location within 30m
        const snapResult = findNearbyLocation(
          { latitude: lat, longitude: lng },
          savedLocations,
          30 // meters
        );

        if (snapResult.location) {
          log.info('Snapped to saved location', { name: snapResult.location.name });
          setEntry(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              location_id: snapResult.location!.location_id,
              place_name: snapResult.location!.name,
              address: snapResult.location!.address,
              neighborhood: snapResult.location!.neighborhood,
              postal_code: snapResult.location!.postal_code,
              city: snapResult.location!.city,
              subdivision: snapResult.location!.subdivision,
              region: snapResult.location!.region,
              country: snapResult.location!.country,
              geocode_status: 'snapped',
            };
          });
          return;
        }

        // No snap match - call reverse geocode API
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
          log.debug('No network, skipping geocode');
          return;
        }

        const response = await reverseGeocode({ latitude: lat, longitude: lng });
        const fields = geocodeResponseToEntryFields(response);

        log.debug('Geocoded address', { city: fields.city, region: fields.region });
        setEntry(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            address: fields.address,
            neighborhood: fields.neighborhood,
            postal_code: fields.postal_code,
            city: fields.city,
            subdivision: fields.subdivision,
            region: fields.region,
            country: fields.country,
            geocode_status: fields.geocode_status,
          };
        });
      } catch (err) {
        log.error('Geocoding failed', err);
      }
    })();
  }, [entry?.entry_latitude, entry?.entry_longitude, entry?.city, entry?.region, entry?.country, savedLocations, setEntry]);

  // =========================================================================
  // Stream Templates
  // =========================================================================

  useEffect(() => {
    // Only for new entries
    if (!isNewEntry || !entry) return;
    // Skip if no stream selected
    if (!entry.stream_id) return;
    // Skip if we already applied template for this stream
    if (lastTemplateStreamIdRef.current === entry.stream_id) return;
    // Skip if streams not loaded
    if (streams.length === 0) return;

    const selectedStream = streams.find(s => s.stream_id === entry.stream_id);
    if (!selectedStream) return;

    lastTemplateStreamIdRef.current = entry.stream_id;
    log.debug('Applying stream templates', { streamId: entry.stream_id, streamName: selectedStream.name });

    const templateDate = new Date();
    const titleIsBlank = !entry.title?.trim();
    const contentIsBlank = !entry.content?.trim();
    let updates: Partial<EntryWithRelations> = {};

    // Apply title template if title is blank
    if (titleIsBlank && selectedStream.entry_title_template) {
      const newTitle = applyTitleTemplate(selectedStream.entry_title_template, {
        date: templateDate,
        streamName: selectedStream.name,
      });
      if (newTitle) {
        updates.title = newTitle;
        log.debug('Applied title template', { newTitle });
      }
    }

    // Apply content template if content is blank
    if (contentIsBlank && selectedStream.entry_content_template) {
      const newContent = applyContentTemplate(selectedStream.entry_content_template, {
        date: templateDate,
        streamName: selectedStream.name,
      });
      if (newContent) {
        updates.content = newContent;
        log.debug('Applied content template', { contentLength: newContent.length });
      }
    }

    // Apply default status if stream uses status
    if (selectedStream.entry_use_status && selectedStream.entry_default_status && selectedStream.entry_default_status !== 'none') {
      updates.status = selectedStream.entry_default_status;
      log.debug('Applied default status', { status: selectedStream.entry_default_status });
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      setEntry(prev => {
        if (!prev) return prev;
        return { ...prev, ...updates };
      });

      // Also update editor if title/content changed
      if (updates.title || updates.content) {
        const newEditorContent = combineTitleAndBody(
          updates.title || entry.title || '',
          updates.content || entry.content || ''
        );
        editorRef.current?.setContent(newEditorContent);
      }
    }
  }, [isNewEntry, entry, streams, setEntry, editorRef]);
}
