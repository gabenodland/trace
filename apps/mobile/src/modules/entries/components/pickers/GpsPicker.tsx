/**
 * GpsPicker - GPS coordinates display and management
 *
 * Features:
 * - Display GPS coordinates with accuracy circle on map
 * - Allow user to tap map to select a custom location (accuracy = -1)
 * - Reload GPS to get fresh coordinates
 * - Save changes only when location differs from original
 * - Option to upgrade to a named Location
 * - Remove GPS from entry
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import MapView, { Marker, Circle as MapCircle, MapPressEvent } from "react-native-maps";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { theme } from "../../../../shared/theme/theme";
import { styles } from "../CaptureForm.styles";
import type { GpsData } from "../hooks/useCaptureFormState";
import type { UnitSystem } from "@trace/core";

// Constants
const MANUAL_SELECTION_ACCURACY = -1;
const DEFAULT_ACCURACY_FOR_ZOOM = 50;
const METERS_PER_DEGREE = 111000;

interface GpsPickerProps {
  visible: boolean;
  onClose: () => void;
  gpsData: GpsData | null;
  onRemove: () => void;
  onReload: () => void;
  onUseLocation: () => void;
  onSave?: (location: GpsData) => void;
  isLoading?: boolean;
  units: UnitSystem;
  onSnackbar: (message: string) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format accuracy in a human-readable way with user's preferred units
 */
function formatAccuracy(accuracy: number | null, units: UnitSystem): string {
  if (accuracy === null || accuracy === undefined) {
    return "Unknown accuracy";
  }

  const displayValue = units === 'imperial'
    ? `±${Math.round(accuracy * 3.28084)}ft`
    : `±${Math.round(accuracy)}m`;

  // Quality rating based on meters
  if (accuracy < 5) return `${displayValue} (Excellent)`;
  if (accuracy < 15) return `${displayValue} (Good)`;
  if (accuracy < 50) return `${displayValue} (Fair)`;
  if (accuracy < 100) return `${displayValue} (Poor)`;
  return `${displayValue} (Very Poor)`;
}

/**
 * Format coordinates for display (degrees, minutes, seconds)
 */
function formatCoordinate(value: number, isLatitude: boolean): string {
  const direction = isLatitude
    ? (value >= 0 ? 'N' : 'S')
    : (value >= 0 ? 'E' : 'W');
  const absValue = Math.abs(value);
  const degrees = Math.floor(absValue);
  const minutes = Math.floor((absValue - degrees) * 60);
  const seconds = ((absValue - degrees - minutes / 60) * 3600).toFixed(1);

  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

/**
 * Calculate map delta based on accuracy for appropriate zoom level
 */
function calculateMapDelta(accuracy: number | null): number {
  const effectiveAccuracy = accuracy && accuracy > 0 ? accuracy : DEFAULT_ACCURACY_FOR_ZOOM;
  return Math.max(0.001, (effectiveAccuracy * 3) / METERS_PER_DEGREE);
}

/**
 * Check if two GPS locations are the same
 */
function locationsEqual(a: GpsData | null, b: GpsData | null): boolean {
  if (!a || !b) return a === b;
  return a.latitude === b.latitude &&
         a.longitude === b.longitude &&
         a.accuracy === b.accuracy;
}

// ============================================================================
// Icon Components
// ============================================================================

function GpsIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3} fill={color} stroke="none" />
      <Line x1={12} y1={2} x2={12} y2={6} strokeLinecap="round" />
      <Line x1={12} y1={18} x2={12} y2={22} strokeLinecap="round" />
      <Line x1={2} y1={12} x2={6} y2={12} strokeLinecap="round" />
      <Line x1={18} y1={12} x2={22} y2={12} strokeLinecap="round" />
    </Svg>
  );
}

function MapPinIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={10} r={3} fill="none" />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
      <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
      <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
    </Svg>
  );
}

function RefreshIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2}>
      <Path d="M1 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RecenterIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2}>
      <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3} fill="#333" stroke="none" />
      <Line x1={12} y1={2} x2={12} y2={5} strokeLinecap="round" />
      <Line x1={12} y1={19} x2={12} y2={22} strokeLinecap="round" />
      <Line x1={2} y1={12} x2={5} y2={12} strokeLinecap="round" />
      <Line x1={19} y1={12} x2={22} y2={12} strokeLinecap="round" />
    </Svg>
  );
}

function MarkerIcon({ isManuallySelected }: { isManuallySelected: boolean }) {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill={isManuallySelected ? "#ef4444" : "#3b82f6"}>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" fill="#ffffff" />
    </Svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GpsPicker({
  visible,
  onClose,
  gpsData,
  onRemove,
  onReload,
  onUseLocation,
  onSave,
  isLoading = false,
  units,
  onSnackbar,
}: GpsPickerProps) {
  const mapRef = useRef<MapView>(null);

  // Track the location when picker opened (to detect changes)
  const [originalLocation, setOriginalLocation] = useState<GpsData | null>(null);

  // Track user's manual selection on map (null = using gpsData)
  const [manualSelection, setManualSelection] = useState<GpsData | null>(null);

  // Initialize/reset state when picker visibility changes
  useEffect(() => {
    if (visible) {
      // Picker opened - capture original state
      setOriginalLocation(gpsData);
      setManualSelection(null);
    } else {
      // Picker closed - reset everything
      setOriginalLocation(null);
      setManualSelection(null);
    }
  }, [visible]);

  // The location to display (manual selection takes priority over GPS data)
  const displayLocation = manualSelection || gpsData;

  // Is current display showing a manually selected point?
  const isManuallySelected = manualSelection !== null || displayLocation?.accuracy === MANUAL_SELECTION_ACCURACY;

  // Has anything changed from the original? (either manual selection or GPS reload)
  const hasChanges = !locationsEqual(displayLocation, originalLocation);

  // Handle map tap to select custom location
  const handleMapPress = useCallback((event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setManualSelection({
      latitude,
      longitude,
      accuracy: MANUAL_SELECTION_ACCURACY,
    });
  }, []);

  // Recenter map on current display location
  const handleRecenter = useCallback(() => {
    if (displayLocation && mapRef.current) {
      const delta = calculateMapDelta(displayLocation.accuracy);
      mapRef.current.animateToRegion({
        latitude: displayLocation.latitude,
        longitude: displayLocation.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }, 300);
    }
  }, [displayLocation]);

  // Handle save - pass the current display location
  const handleSave = useCallback(() => {
    if (displayLocation && onSave) {
      onSave(displayLocation);
      onSnackbar(isManuallySelected ? "Location saved" : "GPS saved");
    }
    onClose();
  }, [displayLocation, onSave, onClose, onSnackbar, isManuallySelected]);

  // Handle use location - close and trigger location picker
  const handleUseLocation = useCallback(() => {
    onClose();
    onUseLocation();
  }, [onClose, onUseLocation]);

  // Handle remove GPS
  const handleRemove = useCallback(() => {
    onRemove();
    onSnackbar("GPS removed");
    onClose();
  }, [onRemove, onSnackbar, onClose]);

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={styles.pickerContainer}>
        {/* Header */}
        <View style={gpsPickerStyles.header}>
          <Text style={gpsPickerStyles.title}>
            {isManuallySelected ? "Selected Location" : "GPS Location"}
          </Text>
          <TouchableOpacity style={gpsPickerStyles.closeButton} onPress={onClose}>
            <CloseIcon />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={gpsPickerStyles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.text.primary} />
            <Text style={gpsPickerStyles.loadingText}>Getting GPS coordinates...</Text>
          </View>
        ) : gpsData ? (
          <>
            {/* Map */}
            <View style={gpsPickerStyles.mapContainer}>
              <MapView
                ref={mapRef}
                style={gpsPickerStyles.map}
                initialRegion={{
                  latitude: gpsData.latitude,
                  longitude: gpsData.longitude,
                  latitudeDelta: calculateMapDelta(gpsData.accuracy),
                  longitudeDelta: calculateMapDelta(gpsData.accuracy),
                }}
                scrollEnabled={true}
                zoomEnabled={true}
                pitchEnabled={false}
                rotateEnabled={false}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsScale={false}
                toolbarEnabled={false}
                onPress={handleMapPress}
              >
                {/* Accuracy circle (only for GPS, not manual selection) */}
                {!isManuallySelected && gpsData.accuracy && gpsData.accuracy > 0 && (
                  <MapCircle
                    center={{ latitude: gpsData.latitude, longitude: gpsData.longitude }}
                    radius={gpsData.accuracy}
                    fillColor="rgba(59, 130, 246, 0.15)"
                    strokeColor="rgba(59, 130, 246, 0.5)"
                    strokeWidth={1}
                  />
                )}
                {/* Location marker */}
                <Marker coordinate={{ latitude: displayLocation!.latitude, longitude: displayLocation!.longitude }}>
                  <View style={gpsPickerStyles.markerContainer}>
                    <MarkerIcon isManuallySelected={isManuallySelected} />
                  </View>
                </Marker>
              </MapView>

              {/* Accuracy overlay */}
              <View style={gpsPickerStyles.accuracyOverlay}>
                <Text style={gpsPickerStyles.accuracyOverlayText}>
                  {isManuallySelected ? "Exact" : formatAccuracy(gpsData.accuracy, units)}
                </Text>
              </View>

              {/* Map buttons */}
              <TouchableOpacity style={gpsPickerStyles.reloadButton} onPress={onReload}>
                <RefreshIcon />
              </TouchableOpacity>
              <TouchableOpacity style={gpsPickerStyles.recenterButton} onPress={handleRecenter}>
                <RecenterIcon />
              </TouchableOpacity>
            </View>

            {/* Coordinates display */}
            <View style={gpsPickerStyles.coordsContainer}>
              <View style={gpsPickerStyles.coordsRow}>
                <View style={gpsPickerStyles.coordColumn}>
                  <Text style={gpsPickerStyles.coordLabel}>Latitude</Text>
                  <Text style={gpsPickerStyles.coordValue}>
                    {formatCoordinate(displayLocation!.latitude, true)}
                  </Text>
                  <Text style={gpsPickerStyles.coordDecimal}>
                    {displayLocation!.latitude.toFixed(6)}
                  </Text>
                </View>
                <View style={gpsPickerStyles.coordColumn}>
                  <Text style={gpsPickerStyles.coordLabel}>Longitude</Text>
                  <Text style={gpsPickerStyles.coordValue}>
                    {formatCoordinate(displayLocation!.longitude, false)}
                  </Text>
                  <Text style={gpsPickerStyles.coordDecimal}>
                    {displayLocation!.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            {hasChanges && (
              <TouchableOpacity
                style={[styles.pickerButton, styles.pickerButtonPrimary]}
                onPress={handleSave}
              >
                <Text style={[styles.pickerButtonText, { color: '#ffffff' }]}>
                  {isManuallySelected ? "Save Selected Location" : "Save GPS"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.pickerButton, hasChanges ? styles.pickerButtonSecondary : styles.pickerButtonPrimary]}
              onPress={handleUseLocation}
            >
              <View style={gpsPickerStyles.useLocationButton}>
                <MapPinIcon color={hasChanges ? theme.colors.text.primary : "#ffffff"} size={16} />
                <Text style={[styles.pickerButtonText, hasChanges ? {} : { color: '#ffffff' }]}>
                  Use Location Instead
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pickerButton, styles.pickerButtonDanger]}
              onPress={handleRemove}
            >
              <Text style={[styles.pickerButtonText, styles.pickerButtonDangerText]}>
                Remove GPS from Entry
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={gpsPickerStyles.noDataContainer}>
            <Text style={gpsPickerStyles.noDataText}>No GPS coordinates captured</Text>
            <TouchableOpacity
              style={[styles.pickerButton, styles.pickerButtonPrimary]}
              onPress={onReload}
            >
              <Text style={[styles.pickerButtonText, { color: '#ffffff' }]}>
                Capture GPS Location
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TopBarDropdownContainer>
  );
}

// ============================================================================
// Styles
// ============================================================================

const mapButtonBase = {
  position: "absolute" as const,
  bottom: 8,
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: "#ffffff",
  justifyContent: "center" as const,
  alignItems: "center" as const,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
};

const gpsPickerStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  mapContainer: {
    aspectRatio: 1,
    width: "100%",
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    marginBottom: theme.spacing.md,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    // Container for custom marker
  },
  accuracyOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  accuracyOverlayText: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.medium,
    color: "#ffffff",
  },
  reloadButton: {
    ...mapButtonBase,
    left: "50%",
    marginLeft: -20,
  },
  recenterButton: {
    ...mapButtonBase,
    right: 8,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  coordsContainer: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  coordsRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  coordColumn: {
    flex: 1,
    gap: 2,
  },
  coordLabel: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coordValue: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  coordDecimal: {
    fontSize: 11,
    color: theme.colors.text.tertiary,
    fontFamily: "monospace",
  },
  noDataContainer: {
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  noDataText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  useLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
