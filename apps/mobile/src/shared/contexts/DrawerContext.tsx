/**
 * DrawerContext
 *
 * Manages drawer state, stream selection, view mode, and gesture control.
 * Provides unified navigation for the left drawer.
 *
 * Map and calendar state are in their own contexts (MapStateContext,
 * CalendarStateContext) to avoid cross-screen re-renders.
 *
 * Supports gesture-driven drawer control via DrawerControl interface.
 */

import { createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode } from "react";

/** View modes for the primary screen */
export type ViewMode = "list" | "map" | "calendar";

type StreamSelectHandler = ((streamId: string | null, streamName: string) => void) | null;
type StreamLongPressHandler = ((streamId: string) => void) | null;
type ViewModeChangeHandler = ((mode: ViewMode) => void) | null;

/** Interface for gesture-driven drawer control */
export interface DrawerControl {
  /** Set drawer position directly (0 = closed, DRAWER_WIDTH = open) */
  setPosition: (translateX: number) => void;
  /** Animate drawer to open position. Pass gesture velocity for spring continuity. */
  animateOpen: (velocity?: number) => void;
  /** Animate drawer to closed position. Pass gesture velocity for spring continuity. */
  animateClose: (velocity?: number) => void;
  /** Get current drawer width */
  getDrawerWidth: () => number;
}

interface DrawerContextValue {
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

  /** Gesture-driven drawer control (registered by StreamDrawer) */
  drawerControl: DrawerControl | null;
  /** Register drawer control methods */
  registerDrawerControl: (control: DrawerControl | null) => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

/** Separate context for isOpen — only drawer UI and back-button handlers need reactive updates */
const DrawerOpenContext = createContext<boolean | null>(null);

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

  const contextValue = useMemo(() => ({
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
    drawerControl,
    registerDrawerControl,
  }), [
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
    drawerControl,
    registerDrawerControl,
  ]);

  return (
    <DrawerContext.Provider value={contextValue}>
      <DrawerOpenContext.Provider value={isOpen}>
        {children}
      </DrawerOpenContext.Provider>
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

/** Read drawer open/close state without subscribing to the full DrawerContext.
 *  Only components that need reactive isOpen updates should use this. */
export function useDrawerOpen(): boolean {
  const isOpen = useContext(DrawerOpenContext);
  if (isOpen === null) {
    throw new Error("useDrawerOpen must be used within a DrawerProvider");
  }
  return isOpen;
}
