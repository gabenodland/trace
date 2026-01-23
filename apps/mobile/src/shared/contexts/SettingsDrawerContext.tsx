/**
 * SettingsDrawerContext
 *
 * Manages settings drawer state (right-side drawer for View/Sort/Filter).
 * Supports gesture-driven drawer control via SettingsDrawerControl interface.
 */

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

/** Interface for gesture-driven drawer control */
export interface SettingsDrawerControl {
  /** Set drawer position directly (0 = closed, DRAWER_WIDTH = open) */
  setPosition: (translateX: number) => void;
  /** Animate drawer to open position */
  animateOpen: () => void;
  /** Animate drawer to closed position */
  animateClose: () => void;
  /** Get current drawer width */
  getDrawerWidth: () => number;
}

interface SettingsDrawerContextValue {
  /** Whether the drawer is currently open */
  isOpen: boolean;
  /** Open the drawer */
  openDrawer: () => void;
  /** Close the drawer */
  closeDrawer: () => void;
  /** Toggle drawer open/close */
  toggleDrawer: () => void;

  /** Gesture-driven drawer control (registered by SettingsDrawer) */
  drawerControl: SettingsDrawerControl | null;
  /** Register drawer control methods */
  registerDrawerControl: (control: SettingsDrawerControl | null) => void;
}

const SettingsDrawerContext = createContext<SettingsDrawerContextValue | null>(null);

interface SettingsDrawerProviderProps {
  children: ReactNode;
}

export function SettingsDrawerProvider({ children }: SettingsDrawerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Gesture-driven drawer control
  const [drawerControl, setDrawerControl] = useState<SettingsDrawerControl | null>(null);

  // Use ref to track current value for comparison in registration function
  const drawerControlRef = useRef<SettingsDrawerControl | null>(null);

  const registerDrawerControl = useCallback((control: SettingsDrawerControl | null) => {
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

  return (
    <SettingsDrawerContext.Provider
      value={{
        isOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        drawerControl,
        registerDrawerControl,
      }}
    >
      {children}
    </SettingsDrawerContext.Provider>
  );
}

export function useSettingsDrawer(): SettingsDrawerContextValue {
  const context = useContext(SettingsDrawerContext);
  if (!context) {
    throw new Error("useSettingsDrawer must be used within a SettingsDrawerProvider");
  }
  return context;
}
