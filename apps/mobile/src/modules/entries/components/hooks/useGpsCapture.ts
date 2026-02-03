/**
 * useGpsCapture - GPS capture logic for EntryScreen
 *
 * Handles:
 * - GPS loading state
 * - Pending location data (before user confirms)
 * - New GPS capture tracking (vs reload)
 * - Auto-capture for new entries
 * - The actual GPS capture function
 *
 * Uses EntryFormContext for form state access.
 * Accepts stream-specific parameters that depend on stream configuration.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Alert } from "react-native";
import * as Location from "expo-location";
import type { Location as LocationType } from "@trace/core";
import { useEntryForm } from "../context/EntryFormContext";

const GPS_TIMEOUT_MS = 15000;

export interface UseGpsCaptureOptions {
  /** Whether stream data is loaded (or no stream selected) - prevents race condition */
  streamReady: boolean;
  /** Whether location is enabled for the current stream */
  locationEnabled: boolean;
}

export interface UseGpsCaptureReturn {
  /** Whether GPS is currently being captured */
  isGpsLoading: boolean;
  /** Whether this is a new GPS capture (vs reload) */
  isNewGpsCapture: boolean;
  /** Set the new GPS capture flag */
  setIsNewGpsCapture: (value: boolean) => void;
  /** Pending location data (before user confirms) */
  pendingLocationData: LocationType | null;
  /**
   * Capture GPS coordinates (creates a dropped pin)
   * @param forceRefresh - if true, skip cache and get fresh GPS reading
   * @param toPending - if true, store in pendingLocationData instead of form
   * @param isInitialCapture - if true, update baseline to avoid dirty state
   */
  captureGps: (forceRefresh?: boolean, toPending?: boolean, isInitialCapture?: boolean) => Promise<void>;
  /** Clear pending location data */
  clearPendingGps: () => void;
  /** Save pending location to form */
  savePendingGps: () => void;
}

/**
 * Manages GPS capture state and logic for the entry screen.
 */
export function useGpsCapture(options: UseGpsCaptureOptions): UseGpsCaptureReturn {
  const { streamReady, locationEnabled } = options;

  // Get state from context
  const {
    isEditing,
    settings,
    formData,
    updateField,
    setBaseline,
    isEditMode,
    enterEditMode,
  } = useEntryForm();

  const captureGpsSetting = settings.captureGpsLocation;
  const currentLocationData = formData.locationData;

  // GPS loading state
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Track if we're capturing GPS from a cleared state (shows Save button instead of Remove)
  const [isNewGpsCapture, setIsNewGpsCapture] = useState(false);

  // Pending location data - holds captured GPS before user confirms with Save button
  const [pendingLocationData, setPendingLocationData] = useState<LocationType | null>(null);

  // Track if auto-capture has been attempted (prevents double capture when deps change)
  const hasAttemptedCapture = useRef(false);

  /**
   * Update location in form
   */
  const onLocationChange = useCallback(
    (location: LocationType | null) => {
      updateField("locationData", location);
    },
    [updateField]
  );

  /**
   * Update baseline for initial capture
   */
  const onBaselineUpdate = useCallback(
    (locationData: LocationType) => {
      setBaseline({ ...formData, locationData });
    },
    [formData, setBaseline]
  );

  /**
   * Capture GPS coordinates (creates a dropped pin location)
   * forceRefresh: if true, skip cache and get fresh GPS reading with high accuracy
   * toPending: if true, store in pendingLocationData instead of formData (for new capture flow)
   * isInitialCapture: if true, this is the initial auto-capture for new entries - update baseline
   */
  const captureGps = useCallback(async (
    forceRefresh = false,
    toPending = false,
    isInitialCapture = false
  ): Promise<void> => {
    setIsGpsLoading(true);

    let timeoutId: NodeJS.Timeout;
    let hasGps = false;

    try {
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
      if (permissionStatus !== "granted") {
        Alert.alert(
          "Permission Denied",
          "GPS permission is required to capture location.",
          [{ text: "OK" }]
        );
        setIsGpsLoading(false);
        return;
      }

      // Set timeout to give up after 15 seconds
      timeoutId = setTimeout(() => {
        if (!hasGps) {
          setIsGpsLoading(false);
          Alert.alert(
            "GPS Unavailable",
            "Could not get your location. Please check that GPS is enabled.",
            [{ text: "OK" }]
          );
        }
      }, GPS_TIMEOUT_MS);

      let location: Location.LocationObject | null = null;

      if (forceRefresh) {
        // Force fresh GPS reading with high accuracy (for reload button)
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } else {
        // For initial capture, try cached first for speed, then fall back to fresh
        location = await Location.getLastKnownPositionAsync();

        if (!location) {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        }
      }

      if (location) {
        hasGps = true;
        clearTimeout(timeoutId);

        // Create minimal location object (dropped pin)
        const locationData: LocationType = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          name: null, // Dropped pin has no name
          source: 'user_custom',
          locationRadius: location.coords.accuracy ?? undefined, // GPS accuracy becomes location radius
        };

        if (toPending) {
          // Store in pending state - user must click Save to commit
          setPendingLocationData(locationData);
        } else {
          // Store directly in form data
          onLocationChange(locationData);

          // For initial auto-capture, also update baseline so form doesn't show as dirty
          if (isInitialCapture) {
            onBaselineUpdate(locationData);
          }
        }
        setIsGpsLoading(false);
        if (!isEditMode) enterEditMode();
      }
    } catch (geoError) {
      clearTimeout(timeoutId!);
      setIsGpsLoading(false);
      Alert.alert(
        "GPS Error",
        "Could not access your location. Please check that GPS is enabled and permissions are granted.",
        [{ text: "OK" }]
      );
    }
  }, [onLocationChange, onBaselineUpdate, isEditMode, enterEditMode]);

  // Store captureGps in a ref so the useEffect can access the latest version
  const captureGpsRef = useRef(captureGps);
  captureGpsRef.current = captureGps;

  // Auto-capture GPS for new entries when setting is enabled
  useEffect(() => {
    // Guard: only attempt capture once
    if (hasAttemptedCapture.current) {
      return;
    }

    // Only auto-capture GPS for new entries (not editing)
    if (isEditing) {
      return;
    }

    // Skip if GPS capture setting is disabled
    if (!captureGpsSetting) {
      return;
    }

    // Wait for stream data to be loaded before making decision
    if (!streamReady) {
      return;
    }

    // Skip if location is not enabled for the current stream
    if (!locationEnabled) {
      return;
    }

    // Skip if we already have location data
    if (currentLocationData) {
      return;
    }

    // Mark that we've attempted capture
    hasAttemptedCapture.current = true;

    // Use the ref to access the function
    captureGpsRef.current(false, false, true);
  }, [isEditing, captureGpsSetting, streamReady, locationEnabled, currentLocationData]);

  const clearPendingGps = useCallback(() => {
    setPendingLocationData(null);
    setIsNewGpsCapture(false);
  }, []);

  const savePendingGps = useCallback(() => {
    if (pendingLocationData) {
      onLocationChange(pendingLocationData);
      setPendingLocationData(null);
      setIsNewGpsCapture(false);
    }
  }, [pendingLocationData, onLocationChange]);

  return {
    isGpsLoading,
    isNewGpsCapture,
    setIsNewGpsCapture,
    pendingLocationData,
    captureGps,
    clearPendingGps,
    savePendingGps,
  };
}
