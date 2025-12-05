/**
 * GpsPicker - GPS coordinates display and management
 * Shows read-only coordinates with accuracy, map preview, and allows removal/reload
 */

import { useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import MapView, { Marker, Circle as MapCircle } from "react-native-maps";
import { TopBarDropdownContainer } from "../../../../components/layout/TopBarDropdownContainer";
import { theme } from "../../../../shared/theme/theme";
import { styles } from "../CaptureForm.styles";
import type { GpsData } from "../hooks/useCaptureFormState";
import type { UnitSystem } from "@trace/core";

interface GpsPickerProps {
  visible: boolean;
  onClose: () => void;
  gpsData: GpsData | null;
  onRemove: () => void;
  onReload: () => void;
  isLoading?: boolean;
  units: UnitSystem;
}

/**
 * Format accuracy in a human-readable way with user's preferred units
 */
function formatAccuracy(accuracy: number | null, units: UnitSystem): string {
  if (accuracy === null || accuracy === undefined) {
    return "Unknown accuracy";
  }

  let displayValue: string;
  if (units === 'imperial') {
    // Convert meters to feet
    const feet = accuracy * 3.28084;
    displayValue = `±${Math.round(feet)}ft`;
  } else {
    displayValue = `±${Math.round(accuracy)}m`;
  }

  // Quality rating based on meters (thresholds remain in metric)
  if (accuracy < 5) {
    return `${displayValue} (Excellent)`;
  } else if (accuracy < 15) {
    return `${displayValue} (Good)`;
  } else if (accuracy < 50) {
    return `${displayValue} (Fair)`;
  } else if (accuracy < 100) {
    return `${displayValue} (Poor)`;
  } else {
    return `${displayValue} (Very Poor)`;
  }
}

/**
 * Format coordinates for display
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

export function GpsPicker({
  visible,
  onClose,
  gpsData,
  onRemove,
  onReload,
  isLoading = false,
  units,
}: GpsPickerProps) {
  const mapRef = useRef<MapView>(null);

  const handleRecenter = () => {
    if (gpsData && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        latitudeDelta: Math.max(0.001, ((gpsData.accuracy || 50) * 3) / 111000),
        longitudeDelta: Math.max(0.001, ((gpsData.accuracy || 50) * 3) / 111000),
      }, 300);
    }
  };

  return (
    <TopBarDropdownContainer visible={visible} onClose={onClose}>
      <View style={styles.pickerContainer}>
        <View style={gpsPickerStyles.header}>
          {/* GPS Crosshair/Target Icon - standard GPS representation */}
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
            {/* Outer circle */}
            <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
            {/* Inner dot */}
            <Circle cx={12} cy={12} r={3} fill={theme.colors.text.primary} stroke="none" />
            {/* Crosshair lines */}
            <Line x1={12} y1={2} x2={12} y2={6} strokeLinecap="round" />
            <Line x1={12} y1={18} x2={12} y2={22} strokeLinecap="round" />
            <Line x1={2} y1={12} x2={6} y2={12} strokeLinecap="round" />
            <Line x1={18} y1={12} x2={22} y2={12} strokeLinecap="round" />
          </Svg>
          <Text style={styles.pickerTitle}>GPS Location</Text>
        </View>

        {isLoading ? (
          <View style={gpsPickerStyles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.text.primary} />
            <Text style={gpsPickerStyles.loadingText}>Getting GPS coordinates...</Text>
          </View>
        ) : gpsData ? (
          <>
            {/* Map Preview */}
            <View style={gpsPickerStyles.mapContainer}>
              <MapView
                ref={mapRef}
                style={gpsPickerStyles.map}
                initialRegion={{
                  latitude: gpsData.latitude,
                  longitude: gpsData.longitude,
                  // Adjust zoom based on accuracy - show at least the accuracy circle
                  // 1 degree latitude ≈ 111km, so we calculate delta to fit accuracy radius
                  latitudeDelta: Math.max(0.001, ((gpsData.accuracy || 50) * 3) / 111000),
                  longitudeDelta: Math.max(0.001, ((gpsData.accuracy || 50) * 3) / 111000),
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
              >
                {/* Accuracy circle - shows the radius of GPS uncertainty */}
                {gpsData.accuracy && (
                  <MapCircle
                    center={{
                      latitude: gpsData.latitude,
                      longitude: gpsData.longitude,
                    }}
                    radius={gpsData.accuracy}
                    fillColor="rgba(59, 130, 246, 0.15)"
                    strokeColor="rgba(59, 130, 246, 0.5)"
                    strokeWidth={1}
                  />
                )}
                <Marker
                  coordinate={{
                    latitude: gpsData.latitude,
                    longitude: gpsData.longitude,
                  }}
                >
                  <View style={gpsPickerStyles.markerContainer}>
                    <Svg width={32} height={32} viewBox="0 0 24 24" fill="#3b82f6">
                      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <Circle cx="12" cy="10" r="3" fill="#ffffff" />
                    </Svg>
                  </View>
                </Marker>
              </MapView>
              {/* Accuracy overlay on map */}
              <View style={gpsPickerStyles.accuracyOverlay}>
                <Text style={gpsPickerStyles.accuracyOverlayText}>
                  {formatAccuracy(gpsData.accuracy, units)}
                </Text>
              </View>
              {/* Recenter button */}
              <TouchableOpacity
                style={gpsPickerStyles.recenterButton}
                onPress={handleRecenter}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2}>
                  <Circle cx={12} cy={12} r={10} strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={12} r={3} fill="#333" stroke="none" />
                  <Line x1={12} y1={2} x2={12} y2={5} strokeLinecap="round" />
                  <Line x1={12} y1={19} x2={12} y2={22} strokeLinecap="round" />
                  <Line x1={2} y1={12} x2={5} y2={12} strokeLinecap="round" />
                  <Line x1={19} y1={12} x2={22} y2={12} strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            </View>

            {/* Coordinates Display - Side by Side */}
            <View style={gpsPickerStyles.coordsContainer}>
              <View style={gpsPickerStyles.coordsRow}>
                <View style={gpsPickerStyles.coordColumn}>
                  <Text style={gpsPickerStyles.coordLabel}>Latitude</Text>
                  <Text style={gpsPickerStyles.coordValue}>
                    {formatCoordinate(gpsData.latitude, true)}
                  </Text>
                  <Text style={gpsPickerStyles.coordDecimal}>
                    {gpsData.latitude.toFixed(6)}
                  </Text>
                </View>

                <View style={gpsPickerStyles.coordColumn}>
                  <Text style={gpsPickerStyles.coordLabel}>Longitude</Text>
                  <Text style={gpsPickerStyles.coordValue}>
                    {formatCoordinate(gpsData.longitude, false)}
                  </Text>
                  <Text style={gpsPickerStyles.coordDecimal}>
                    {gpsData.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.pickerActionRow}>
              <TouchableOpacity
                style={styles.pickerActionButton}
                onPress={() => {
                  onReload();
                }}
              >
                <Text style={styles.pickerButtonText}>Reload GPS</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.pickerButton, styles.pickerButtonDanger]}
              onPress={() => {
                onRemove();
                onClose();
              }}
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
              onPress={() => {
                onReload();
              }}
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

import { StyleSheet } from "react-native";

const gpsPickerStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
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
  recenterButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
});
