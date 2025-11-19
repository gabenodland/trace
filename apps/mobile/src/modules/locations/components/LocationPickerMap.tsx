/**
 * LocationPickerMap - Map components for LocationPicker
 * Separated to allow lazy loading of react-native-maps
 */

import MapView, { Marker } from 'react-native-maps';
import { View, StyleSheet } from 'react-native';
import type { POIItem } from '@trace/core';

interface LocationPickerMapProps {
  mapRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onRegionChangeComplete: (region: any) => void;
  nearbyPOIs?: POIItem[];
  onPOIPress?: (poi: POIItem) => void;
}

export function LocationPickerMap({
  mapRegion,
  onRegionChangeComplete,
  nearbyPOIs,
  onPOIPress
}: LocationPickerMapProps) {
  return (
    <MapView
      style={styles.map}
      initialRegion={mapRegion}
      onRegionChangeComplete={onRegionChangeComplete}
      showsUserLocation
      showsMyLocationButton
    >
      {nearbyPOIs?.map((poi) => (
        <Marker
          key={poi.id}
          coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
          title={poi.name}
          description={poi.categories?.[0]?.name}
          onPress={() => onPOIPress?.(poi)}
        />
      ))}
    </MapView>
  );
}

export function LocationPickerCustomMap({
  mapRegion,
  onRegionChangeComplete
}: {
  mapRegion: any;
  onRegionChangeComplete: (region: any) => void;
}) {
  return (
    <MapView
      style={styles.customMap}
      initialRegion={mapRegion}
      onRegionChangeComplete={onRegionChangeComplete}
      showsUserLocation
      showsMyLocationButton
    />
  );
}

const styles = StyleSheet.create({
  map: {
    height: 200,
    borderRadius: 8,
  },
  customMap: {
    height: 200,
    borderRadius: 8,
  },
});
