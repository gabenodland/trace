/**
 * MapStateContext
 *
 * Persisted map region that survives navigation to sub-screens.
 * Extracted from DrawerContext to prevent CalendarScreen re-renders
 * when map region changes.
 */

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import type { Region } from "react-native-maps";

interface MapStateContextValue {
  /** Persisted map region (survives navigation to sub-screens) */
  mapRegion: Region | null;
  /** Update map region */
  setMapRegion: (region: Region) => void;
}

const MapStateContext = createContext<MapStateContextValue | null>(null);

export function MapStateProvider({ children }: { children: ReactNode }) {
  const [mapRegion, setMapRegion] = useState<Region | null>(null);

  const contextValue = useMemo(() => ({
    mapRegion,
    setMapRegion,
  }), [mapRegion]);

  return (
    <MapStateContext.Provider value={contextValue}>
      {children}
    </MapStateContext.Provider>
  );
}

export function useMapState(): MapStateContextValue {
  const context = useContext(MapStateContext);
  if (!context) {
    throw new Error("useMapState must be used within a MapStateProvider");
  }
  return context;
}
