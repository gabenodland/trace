/**
 * DrawerContext
 *
 * Manages drawer state, stream selection, and view mode.
 * Provides unified navigation for the left drawer.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/** View modes for the primary screen */
export type ViewMode = "list" | "map" | "calendar";

type StreamSelectHandler = ((streamId: string | null, streamName: string) => void) | null;
type ViewModeChangeHandler = ((mode: ViewMode) => void) | null;

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
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

interface DrawerProviderProps {
  children: ReactNode;
}

export function DrawerProvider({ children }: DrawerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [onStreamSelect, setOnStreamSelect] = useState<StreamSelectHandler>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>("all");
  const [selectedStreamName, setSelectedStreamName] = useState<string>("All Entries");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [onViewModeChange, setOnViewModeChange] = useState<ViewModeChangeHandler>(null);

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
    setOnStreamSelect(() => handler);
  }, []);

  const registerViewModeHandler = useCallback((handler: ViewModeChangeHandler) => {
    setOnViewModeChange(() => handler);
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
        selectedStreamId,
        selectedStreamName,
        setSelectedStreamId,
        setSelectedStreamName,
        viewMode,
        setViewMode,
        onViewModeChange,
        registerViewModeHandler,
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
