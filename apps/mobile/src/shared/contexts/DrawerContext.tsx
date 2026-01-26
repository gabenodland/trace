/**
 * DrawerContext
 *
 * Manages drawer state, stream selection, view mode, and main view state.
 * Provides unified navigation for the left drawer.
 *
 * Main view state (map region, calendar date) is preserved here so
 * navigating to sub-screens (entry, settings) and back preserves position.
 *
 * Supports gesture-driven drawer control via DrawerControl interface.
 */

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { Region } from "react-native-maps";

/** View modes for the primary screen */
export type ViewMode = "list" | "map" | "calendar";

type StreamSelectHandler = ((streamId: string | null, streamName: string) => void) | null;
type StreamLongPressHandler = ((streamId: string) => void) | null;
type ViewModeChangeHandler = ((mode: ViewMode) => void) | null;

/** Calendar zoom levels */
export type CalendarZoom = "day" | "week" | "month" | "year";

/** Interface for gesture-driven drawer control */
export interface DrawerControl {
  /** Set drawer position directly (0 = closed, DRAWER_WIDTH = open) */
  setPosition: (translateX: number) => void;
  /** Animate drawer to open position */
  animateOpen: () => void;
  /** Animate drawer to closed position */
  animateClose: () => void;
  /** Get current drawer width */
  getDrawerWidth: () => number;
}

interface DrawerContextValue {
  /** Whether the drawer is currently open */
  isOpen: boolean;
  /** Open the drawer */
  openDrawer: () => void;
  /** Close the drawer */
  closeDrawer: () => void;
  /** Toggle drawer open/close */
  toggleDrawer: () => void;

  /** Current stream selection handler (registered by primary screens) */
  onStreamSelect: StreamSelectHandler;
  /** Register a stream selection handler */
  registerStreamHandler: (handler: StreamSelectHandler) => void;

  /** Long-press handler for editing streams */
  onStreamLongPress: StreamLongPressHandler;
  /** Register a stream long-press handler */
  registerStreamLongPressHandler: (handler: StreamLongPressHandler) => void;

  /** Currently selected stream ID (for highlighting) */
  selectedStreamId: string | null;
  /** Currently selected stream name (for display) */
  selectedStreamName: string;
  /** Update selected stream ID and name */
  setSelectedStreamId: (id: string | null) => void;
  /** Update selected stream name */
  setSelectedStreamName: (name: string) => void;

  /** Current view mode (list, map, calendar) */
  viewMode: ViewMode;
  /** Update view mode */
  setViewMode: (mode: ViewMode) => void;
  /** View mode change handler (for navigation) */
  onViewModeChange: ViewModeChangeHandler;
  /** Register a view mode change handler */
  registerViewModeHandler: (handler: ViewModeChangeHandler) => void;

  /** Persisted map region (survives navigation to sub-screens) */
  mapRegion: Region | null;
  /** Update map region */
  setMapRegion: (region: Region) => void;

  /** Persisted calendar date (survives navigation to sub-screens) */
  calendarDate: string;
  /** Update calendar date */
  setCalendarDate: (date: string) => void;
  /** Persisted calendar zoom level */
  calendarZoom: CalendarZoom;
  /** Update calendar zoom */
  setCalendarZoom: (zoom: CalendarZoom) => void;

  /** Gesture-driven drawer control (registered by StreamDrawer) */
  drawerControl: DrawerControl | null;
  /** Register drawer control methods */
  registerDrawerControl: (control: DrawerControl | null) => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

interface DrawerProviderProps {
  children: ReactNode;
}

export function DrawerProvider({ children }: DrawerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [onStreamSelect, setOnStreamSelect] = useState<StreamSelectHandler>(null);
  const [onStreamLongPress, setOnStreamLongPress] = useState<StreamLongPressHandler>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>("all");
  const [selectedStreamName, setSelectedStreamName] = useState<string>("All Entries");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [onViewModeChange, setOnViewModeChange] = useState<ViewModeChangeHandler>(null);

  // Persisted main view state
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [calendarDate, setCalendarDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [calendarZoom, setCalendarZoom] = useState<CalendarZoom>("month");

  // Gesture-driven drawer control
  const [drawerControl, setDrawerControl] = useState<DrawerControl | null>(null);

  // Use refs to track current values for comparison in registration functions
  const drawerControlRef = useRef<DrawerControl | null>(null);
  const streamHandlerRef = useRef<StreamSelectHandler>(null);
  const streamLongPressHandlerRef = useRef<StreamLongPressHandler>(null);
  const viewModeHandlerRef = useRef<ViewModeChangeHandler>(null);

  const registerDrawerControl = useCallback((control: DrawerControl | null) => {
    // Only update if actually different to prevent re-render loops
    if (drawerControlRef.current !== control) {
      drawerControlRef.current = control;
      setDrawerControl(control);
    }
  }, []);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const registerStreamHandler = useCallback((handler: StreamSelectHandler) => {
    // Only update if actually different to prevent re-render loops
    if (streamHandlerRef.current !== handler) {
      streamHandlerRef.current = handler;
      setOnStreamSelect(() => handler);
    }
  }, []);

  const registerStreamLongPressHandler = useCallback((handler: StreamLongPressHandler) => {
    // Only update if actually different to prevent re-render loops
    if (streamLongPressHandlerRef.current !== handler) {
      streamLongPressHandlerRef.current = handler;
      setOnStreamLongPress(() => handler);
    }
  }, []);

  const registerViewModeHandler = useCallback((handler: ViewModeChangeHandler) => {
    // Only update if actually different to prevent re-render loops
    if (viewModeHandlerRef.current !== handler) {
      viewModeHandlerRef.current = handler;
      setOnViewModeChange(() => handler);
    }
  }, []);

  return (
    <DrawerContext.Provider
      value={{
        isOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        onStreamSelect,
        registerStreamHandler,
        onStreamLongPress,
        registerStreamLongPressHandler,
        selectedStreamId,
        selectedStreamName,
        setSelectedStreamId,
        setSelectedStreamName,
        viewMode,
        setViewMode,
        onViewModeChange,
        registerViewModeHandler,
        mapRegion,
        setMapRegion,
        calendarDate,
        setCalendarDate,
        calendarZoom,
        setCalendarZoom,
        drawerControl,
        registerDrawerControl,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer(): DrawerContextValue {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error("useDrawer must be used within a DrawerProvider");
  }
  return context;
}
