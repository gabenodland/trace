/**
 * useAutoGeocode - Automatic location snapping and reverse geocoding
 *
 * When GPS data is captured, this hook automatically:
 * 1. FIRST: Tries to snap to a saved location within ~100ft (30m)
 * 2. If no snap match: Calls the Mapbox reverse geocode API
 * 3. Parses the response into entry location fields
 * 4. Updates the form with city, region, country, etc.
 *
 * Uses EntryFormContext for form state access.
 * Accepts saved locations and stream-specific parameters.
 */

import { useEffect, useRef, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  reverseGeocode,
  geocodeResponseToEntryFields,
  findNearbyLocation,
  type Location as LocationType,
  type LocationEntity,
} from "@trace/core";
import { useEntryForm, type GeocodeStatus } from "../context/EntryFormContext";
import { createScopedLogger } from "../../../../shared/utils/logger";

const log = createScopedLogger('AutoGeocode', '📍');

/** Threshold for location snapping: 100 feet ≈ 30 meters */
const SNAP_THRESHOLD_METERS = 30;

export interface UseAutoGeocodeOptions {
  /** Saved locations to check for snapping */
  savedLocations: LocationEntity[];
  /** Whether location is enabled for this stream (skip snapping if false) */
  locationEnabled: boolean;
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
  const { savedLocations, locationEnabled } = options;

  // Get state from context
  const {
    isEditing,
    formData,
    updateField,
    setBaseline,
  } = useEntryForm();

  const locationData = formData.locationData;
  const geocodeStatus = formData.geocodeStatus;
  const isInitialCapture = !isEditing;

  // Track if geocoding is in progress
  const isGeocodingRef = useRef(false);

  // Track the last processed coordinates to avoid duplicate calls
  const lastProcessedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  /**
   * Update location fields in form
   */
  const onLocationFieldsChange = useCallback(
    (fields: Partial<LocationType>) => {
      if (formData.locationData) {
        updateField("locationData", { ...formData.locationData, ...fields });
      }
    },
    [formData.locationData, updateField]
  );

  /**
   * Update geocode status
   */
  const onGeocodeStatusChange = useCallback(
    (status: GeocodeStatus) => {
      updateField("geocodeStatus", status);
    },
    [updateField]
  );

  /**
   * Handle snapping to a saved location
   */
  const onLocationIdChange = useCallback(
    (snappedLocation: {
      location_id: string;
      name: string;
      address: string | null;
      neighborhood: string | null;
      postal_code: string | null;
      city: string | null;
      subdivision: string | null;
      region: string | null;
      country: string | null;
    } | null) => {
      if (snappedLocation && formData.locationData) {
        const snappedLocationData: LocationType = {
          // Keep original coordinates and locationRadius from captured location
          latitude: formData.locationData.latitude,
          longitude: formData.locationData.longitude,
          locationRadius: formData.locationData.locationRadius,
          // Copy ALL geo fields from the saved location
          location_id: snappedLocation.location_id,
          name: snappedLocation.name,
          source: 'user_custom',
          address: snappedLocation.address || undefined,
          neighborhood: snappedLocation.neighborhood || undefined,
          postalCode: snappedLocation.postal_code || undefined,
          city: snappedLocation.city || undefined,
          subdivision: snappedLocation.subdivision || undefined,
          region: snappedLocation.region || undefined,
          country: snappedLocation.country || undefined,
        };
        updateField("locationData", snappedLocationData);
      }
    },
    [formData.locationData, updateField]
  );

  /**
   * Update baseline for initial capture
   */
  const onBaselineLocationFieldsUpdate = useCallback(
    (fields: Partial<LocationType> & { geocode_status?: GeocodeStatus }) => {
      if (isInitialCapture) {
        const updatedLocationData: LocationType | null = formData.locationData
          ? { ...formData.locationData, ...fields }
          : null;
        setBaseline({
          ...formData,
          locationData: updatedLocationData,
          geocodeStatus: fields.geocode_status ?? formData.geocodeStatus,
        });
      }
    },
    [isInitialCapture, formData, setBaseline]
  );

  /**
   * Perform location snap and/or reverse geocoding for the given coordinates
   */
  const performSnapOrGeocode = useCallback(async (latitude: number, longitude: number): Promise<void> => {
    // Prevent concurrent processing
    if (isGeocodingRef.current) {
      return;
    }

    // Check if we've already processed these coordinates
    if (
      lastProcessedCoordsRef.current &&
      Math.abs(lastProcessedCoordsRef.current.lat - latitude) < 0.00001 &&
      Math.abs(lastProcessedCoordsRef.current.lng - longitude) < 0.00001
    ) {
      return;
    }

    isGeocodingRef.current = true;
    onGeocodeStatusChange('pending');

    try {
      // STEP 1: Try to snap to a saved location first
      const snapResult = findNearbyLocation(
        { latitude, longitude },
        savedLocations,
        SNAP_THRESHOLD_METERS
      );

      if (snapResult.location) {
        // Found a saved location within threshold - snap to it!
        onLocationFieldsChange({
          address: snapResult.location.address || undefined,
          neighborhood: snapResult.location.neighborhood || undefined,
          postalCode: snapResult.location.postal_code || undefined,
          city: snapResult.location.city || undefined,
          subdivision: snapResult.location.subdivision || undefined,
          region: snapResult.location.region || undefined,
          country: snapResult.location.country || undefined,
        });
        onGeocodeStatusChange('snapped');

        // Set the location_id to link to the saved location
        onLocationIdChange(snapResult.location);

        // For initial capture, also update baseline
        if (isInitialCapture) {
          onBaselineLocationFieldsUpdate({
            address: snapResult.location.address || undefined,
            neighborhood: snapResult.location.neighborhood || undefined,
            postalCode: snapResult.location.postal_code || undefined,
            city: snapResult.location.city || undefined,
            subdivision: snapResult.location.subdivision || undefined,
            region: snapResult.location.region || undefined,
            country: snapResult.location.country || undefined,
            geocode_status: 'snapped',
          });
        }

        // Track the processed coordinates
        lastProcessedCoordsRef.current = { lat: latitude, lng: longitude };
        return;
      }

      // STEP 2: No snap match - fall back to geocode API

      // Check network connectivity before making API call
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        onGeocodeStatusChange(null);
        return;
      }

      const response = await reverseGeocode({ latitude, longitude });
      const fields = geocodeResponseToEntryFields(response);

      // Update form with geocoded fields
      onLocationFieldsChange({
        address: fields.address || undefined,
        neighborhood: fields.neighborhood || undefined,
        postalCode: fields.postal_code || undefined,
        city: fields.city || undefined,
        subdivision: fields.subdivision || undefined,
        region: fields.region || undefined,
        country: fields.country || undefined,
      });
      onGeocodeStatusChange(fields.geocode_status as GeocodeStatus);

      // For initial capture, also update baseline
      if (isInitialCapture) {
        onBaselineLocationFieldsUpdate({
          address: fields.address || undefined,
          neighborhood: fields.neighborhood || undefined,
          postalCode: fields.postal_code || undefined,
          city: fields.city || undefined,
          subdivision: fields.subdivision || undefined,
          region: fields.region || undefined,
          country: fields.country || undefined,
          geocode_status: fields.geocode_status as GeocodeStatus,
        });
      }

      // Track the processed coordinates
      lastProcessedCoordsRef.current = { lat: latitude, lng: longitude };
    } catch (error) {
      log.error('Geocoding failed', error);
      onGeocodeStatusChange('error');
    } finally {
      isGeocodingRef.current = false;
    }
  }, [
    savedLocations,
    isInitialCapture,
    onLocationFieldsChange,
    onGeocodeStatusChange,
    onLocationIdChange,
    onBaselineLocationFieldsUpdate,
  ]);

  /**
   * Manually trigger snap/geocoding (useful for retry)
   */
  const triggerGeocode = useCallback(async (): Promise<void> => {
    if (!locationData || locationData.latitude == null || locationData.longitude == null) {
      return;
    }

    // Reset the last processed coords so we can re-process
    lastProcessedCoordsRef.current = null;

    await performSnapOrGeocode(locationData.latitude, locationData.longitude);
  }, [locationData, performSnapOrGeocode]);

  // Auto-geocode when location data changes
  useEffect(() => {
    // Skip if location is not enabled for this stream
    if (!locationEnabled) {
      return;
    }

    // Skip if no location coordinates
    if (!locationData || locationData.latitude == null || locationData.longitude == null) {
      return;
    }

    // Skip if we already have geocoded data (locationData has city/region/country)
    if (locationData.city || locationData.region || locationData.country) {
      return;
    }

    // Skip if geocode already attempted and got no_data
    if (geocodeStatus === 'no_data') {
      return;
    }

    // Skip if already snapped to a location
    if (geocodeStatus === 'snapped') {
      return;
    }

    // Skip if geocode already successful
    if (geocodeStatus === 'success') {
      return;
    }

    // Perform snap check and/or geocoding
    performSnapOrGeocode(locationData.latitude, locationData.longitude);
  }, [locationData, geocodeStatus, locationEnabled, performSnapOrGeocode]);

  return {
    isGeocoding: isGeocodingRef.current,
    triggerGeocode,
  };
}
