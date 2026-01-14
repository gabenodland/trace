/**
 * useGpsCapture - GPS capture logic for EntryScreen
 *
 * Handles:
 * - GPS loading state
 * - Pending GPS data (before user confirms)
 * - New GPS capture tracking (vs reload)
 * - Auto-capture for new entries
 * - The actual GPS capture function
 */

import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import * as Location from "expo-location";
import type { GpsData } from "./useCaptureFormState";

const GPS_TIMEOUT_MS = 15000;

export interface UseGpsCaptureOptions {
  /** Whether we're editing an existing entry */
  isEditing: boolean;
  /** Whether GPS capture setting is enabled */
  captureGpsSetting: boolean;
  /** Current GPS data from form */
  currentGpsData: GpsData | null;
  /** Callback to update form GPS data */
  onGpsChange: (gps: GpsData | null) => void;
  /** Callback to update baseline (for initial capture) */
  onBaselineUpdate: (gpsData: GpsData) => void;
  /** Whether form is in edit mode */
  isEditMode: boolean;
  /** Callback to enter edit mode */
  enterEditMode: () => void;
}

export interface UseGpsCaptureReturn {
  /** Whether GPS is currently being captured */
  isGpsLoading: boolean;
  /** Whether this is a new GPS capture (vs reload) */
  isNewGpsCapture: boolean;
  /** Set the new GPS capture flag */
  setIsNewGpsCapture: (value: boolean) => void;
  /** Pending GPS data (before user confirms) */
  pendingGpsData: GpsData | null;
  /**
   * Capture GPS coordinates
   * @param forceRefresh - if true, skip cache and get fresh GPS reading
   * @param toPending - if true, store in pendingGpsData instead of form
   * @param isInitialCapture - if true, update baseline to avoid dirty state
   */
  captureGps: (forceRefresh?: boolean, toPending?: boolean, isInitialCapture?: boolean) => Promise<void>;
  /** Clear pending GPS data */
  clearPendingGps: () => void;
  /** Save pending GPS to form */
  savePendingGps: () => void;
}

/**
 * Manages GPS capture state and logic for the entry screen.
 */
export function useGpsCapture(options: UseGpsCaptureOptions): UseGpsCaptureReturn {
  const {
    isEditing,
    captureGpsSetting,
    currentGpsData,
    onGpsChange,
    onBaselineUpdate,
    isEditMode,
    enterEditMode,
  } = options;

  // GPS loading state
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Track if we're capturing GPS from a cleared state (shows Save button instead of Remove)
  const [isNewGpsCapture, setIsNewGpsCapture] = useState(false);

  // Pending GPS data - holds captured GPS before user confirms with Save button
  const [pendingGpsData, setPendingGpsData] = useState<GpsData | null>(null);

  // Auto-capture GPS for new entries when setting is enabled
  useEffect(() => {
    // Only auto-capture GPS for new entries (not editing)
    if (isEditing) {
      return;
    }

    // Skip if GPS capture setting is disabled
    if (!captureGpsSetting) {
      return;
    }

    // Skip if we already have GPS data
    if (currentGpsData) {
      return;
    }

    // Capture GPS - pass isInitialCapture=true so baseline is updated
    captureGps(false, false, true);
  }, [isEditing, captureGpsSetting]);

  /**
   * Capture GPS coordinates
   * forceRefresh: if true, skip cache and get fresh GPS reading with high accuracy
   * toPending: if true, store in pendingGpsData instead of formData (for new capture flow)
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
        const gpsData: GpsData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        };

        if (toPending) {
          // Store in pending state - user must click Save to commit
          setPendingGpsData(gpsData);
        } else {
          // Store directly in form data
          onGpsChange(gpsData);

          // For initial auto-capture, also update baseline so form doesn't show as dirty
          if (isInitialCapture) {
            onBaselineUpdate(gpsData);
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
  }, [onGpsChange, onBaselineUpdate, isEditMode, enterEditMode]);

  const clearPendingGps = useCallback(() => {
    setPendingGpsData(null);
    setIsNewGpsCapture(false);
  }, []);

  const savePendingGps = useCallback(() => {
    if (pendingGpsData) {
      onGpsChange(pendingGpsData);
      setPendingGpsData(null);
      setIsNewGpsCapture(false);
    }
  }, [pendingGpsData, onGpsChange]);

  return {
    isGpsLoading,
    isNewGpsCapture,
    setIsNewGpsCapture,
    pendingGpsData,
    captureGps,
    clearPendingGps,
    savePendingGps,
  };
}
