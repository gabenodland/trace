/**
 * useAutoGeocode - Automatic location snapping and reverse geocoding
 *
 * When GPS data is captured, this hook automatically:
 * 1. FIRST: Tries to snap to a saved location within ~100ft (30m)
 * 2. If no snap match: Calls the Mapbox reverse geocode API
 * 3. Parses the response into entry location fields
 * 4. Updates the form with city, region, country, etc.
 *
 * The hook tracks geocode_status to:
 * - 'snapped' = matched to a saved location (no API call needed)
 * - 'success' = got data from Mapbox reverse geocode API
 * - 'no_data' = API returned no address data (ocean, wilderness)
 * - 'error' = API call failed
 * - null = never attempted
 */

import { useEffect, useRef, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  reverseGeocode,
  geocodeResponseToEntryFields,
  findNearbyLocation,
  type EntryLocationFields,
  type Location as LocationType,
  type LocationEntity,
} from "@trace/core";
import type { GpsData, GeocodeStatus } from "./useCaptureFormState";

/** Threshold for location snapping: 100 feet ≈ 30 meters */
const SNAP_THRESHOLD_METERS = 30;

export interface UseAutoGeocodeOptions {
  /** Current GPS data from form */
  gpsData: GpsData | null;
  /** Current location data from form (may already have geocoded data) */
  locationData: LocationType | null;
  /** Current geocode status */
  geocodeStatus: GeocodeStatus;
  /** Saved locations to check for snapping */
  savedLocations: LocationEntity[];
  /** Whether location is enabled for this stream (skip snapping if false) */
  locationEnabled: boolean;
  /** Callback to update location fields */
  onLocationFieldsChange: (fields: Partial<EntryLocationFields>) => void;
  /** Callback to update geocode status */
  onGeocodeStatusChange: (status: 'pending' | 'success' | 'snapped' | 'no_data' | 'error' | null) => void;
  /** Callback to set location_id when snapping to saved location */
  onLocationIdChange?: (locationId: string | null, locationName: string | null) => void;
  /** Whether this is initial capture (should update baseline) */
  isInitialCapture: boolean;
  /** Callback to update baseline for initial capture */
  onBaselineLocationFieldsUpdate?: (fields: Partial<EntryLocationFields>) => void;
}

export interface UseAutoGeocodeReturn {
  /** Whether geocoding is in progress */
  isGeocoding: boolean;
  /** Manually trigger geocoding (useful for retry) */
  triggerGeocode: () => Promise<void>;
}

/**
 * Automatically snaps to saved locations or geocodes GPS coordinates
 */
export function useAutoGeocode(options: UseAutoGeocodeOptions): UseAutoGeocodeReturn {
  const {
    gpsData,
    locationData,
    geocodeStatus,
    savedLocations,
    locationEnabled,
    onLocationFieldsChange,
    onGeocodeStatusChange,
    onLocationIdChange,
    isInitialCapture,
    onBaselineLocationFieldsUpdate,
  } = options;

  // Track if geocoding is in progress
  const isGeocodingRef = useRef(false);

  // Track the last processed coordinates to avoid duplicate calls
  const lastProcessedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  /**
   * Perform location snap and/or reverse geocoding for the given coordinates
   * Snap-first: checks saved locations before calling geocode API
   */
  const performSnapOrGeocode = useCallback(async (latitude: number, longitude: number): Promise<void> => {
    // Prevent concurrent processing
    if (isGeocodingRef.current) {
      console.log('[AutoGeocode] Already processing, skipping');
      return;
    }

    // Check if we've already processed these coordinates
    if (
      lastProcessedCoordsRef.current &&
      Math.abs(lastProcessedCoordsRef.current.lat - latitude) < 0.00001 &&
      Math.abs(lastProcessedCoordsRef.current.lng - longitude) < 0.00001
    ) {
      console.log('[AutoGeocode] Coordinates already processed, skipping');
      return;
    }

    isGeocodingRef.current = true;
    onGeocodeStatusChange('pending');

    try {
      // STEP 1: Try to snap to a saved location first
      console.log('[AutoGeocode] Checking for nearby saved locations...');
      const snapResult = findNearbyLocation(
        { latitude, longitude },
        savedLocations,
        SNAP_THRESHOLD_METERS
      );

      if (snapResult.location) {
        // Found a saved location within threshold - snap to it!
        console.log('[AutoGeocode] ✅ Snapped to saved location:', snapResult.location.name,
          `(${snapResult.distanceMeters?.toFixed(1)}m away)`);

        // Update form with snapped location data
        onLocationFieldsChange({
          address: snapResult.location.address,
          neighborhood: snapResult.location.neighborhood,
          postal_code: snapResult.location.postal_code,
          city: snapResult.location.city,
          subdivision: snapResult.location.subdivision,
          region: snapResult.location.region,
          country: snapResult.location.country,
        });
        onGeocodeStatusChange('snapped');

        // Set the location_id to link to the saved location
        if (onLocationIdChange) {
          onLocationIdChange(snapResult.location.location_id, snapResult.location.name);
        }

        // For initial capture, also update baseline
        if (isInitialCapture && onBaselineLocationFieldsUpdate) {
          onBaselineLocationFieldsUpdate({
            address: snapResult.location.address,
            neighborhood: snapResult.location.neighborhood,
            postal_code: snapResult.location.postal_code,
            city: snapResult.location.city,
            subdivision: snapResult.location.subdivision,
            region: snapResult.location.region,
            country: snapResult.location.country,
            geocode_status: 'snapped',
          });
        }

        // Track the processed coordinates
        lastProcessedCoordsRef.current = { lat: latitude, lng: longitude };
        return;
      }

      // STEP 2: No snap match - fall back to geocode API
      console.log('[AutoGeocode] No nearby saved location, checking network for geocode...');

      // Check network connectivity before making API call
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        console.log('[AutoGeocode] No network connection, skipping geocode');
        onGeocodeStatusChange(null); // Reset so we can retry later
        return;
      }

      console.log('[AutoGeocode] Starting reverse geocode for:', latitude.toFixed(6), longitude.toFixed(6));

      const response = await reverseGeocode({ latitude, longitude });
      const fields = geocodeResponseToEntryFields(response);

      console.log('[AutoGeocode] Got location fields:', {
        city: fields.city,
        region: fields.region,
        country: fields.country,
        status: fields.geocode_status,
      });

      // Update form with geocoded fields
      onLocationFieldsChange({
        address: fields.address,
        neighborhood: fields.neighborhood,
        postal_code: fields.postal_code,
        city: fields.city,
        subdivision: fields.subdivision,
        region: fields.region,
        country: fields.country,
      });
      onGeocodeStatusChange(fields.geocode_status);

      // For initial capture, also update baseline
      if (isInitialCapture && onBaselineLocationFieldsUpdate) {
        onBaselineLocationFieldsUpdate({
          address: fields.address,
          neighborhood: fields.neighborhood,
          postal_code: fields.postal_code,
          city: fields.city,
          subdivision: fields.subdivision,
          region: fields.region,
          country: fields.country,
          geocode_status: fields.geocode_status,
        });
      }

      // Track the processed coordinates
      lastProcessedCoordsRef.current = { lat: latitude, lng: longitude };
    } catch (error) {
      console.error('[AutoGeocode] Error:', error);
      onGeocodeStatusChange('error');
    } finally {
      isGeocodingRef.current = false;
    }
  }, [savedLocations, onLocationFieldsChange, onGeocodeStatusChange, onLocationIdChange, isInitialCapture, onBaselineLocationFieldsUpdate]);

  /**
   * Manually trigger snap/geocoding (useful for retry)
   */
  const triggerGeocode = useCallback(async (): Promise<void> => {
    if (!gpsData) {
      console.log('[AutoGeocode] No GPS data to geocode');
      return;
    }

    // Reset the last processed coords so we can re-process
    lastProcessedCoordsRef.current = null;

    await performSnapOrGeocode(gpsData.latitude, gpsData.longitude);
  }, [gpsData, performSnapOrGeocode]);

  // Auto-geocode when GPS data changes
  useEffect(() => {
    // Skip if location is not enabled for this stream
    if (!locationEnabled) {
      console.log('[AutoGeocode] Location not enabled for stream, skipping');
      return;
    }

    // Skip if no GPS data
    if (!gpsData) {
      return;
    }

    // Skip if we already have geocoded data (locationData has city/region/country)
    // This prevents re-geocoding when editing an entry that already has location data
    if (locationData?.city || locationData?.region || locationData?.country) {
      console.log('[AutoGeocode] Already have location hierarchy data, skipping');
      return;
    }

    // Skip if geocode already attempted and got no_data
    // (Don't keep hitting the API for middle-of-ocean locations)
    if (geocodeStatus === 'no_data') {
      console.log('[AutoGeocode] Previous geocode returned no_data, skipping');
      return;
    }

    // Skip if already snapped to a location
    if (geocodeStatus === 'snapped') {
      console.log('[AutoGeocode] Already snapped to saved location, skipping');
      return;
    }

    // Skip if geocode already successful
    if (geocodeStatus === 'success') {
      console.log('[AutoGeocode] Already geocoded successfully, skipping');
      return;
    }

    // Perform snap check and/or geocoding
    performSnapOrGeocode(gpsData.latitude, gpsData.longitude);
  }, [gpsData, locationData, geocodeStatus, locationEnabled, performSnapOrGeocode]);

  return {
    isGeocoding: isGeocodingRef.current,
    triggerGeocode,
  };
}
