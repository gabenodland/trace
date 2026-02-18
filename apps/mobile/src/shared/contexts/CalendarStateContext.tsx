/**
 * CalendarStateContext
 *
 * Persisted calendar state (date, zoom level) that survives navigation
 * to sub-screens. Extracted from DrawerContext to prevent MapScreen
 * re-renders when calendar state changes.
 */

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

/** Calendar zoom levels */
export type CalendarZoom = "day" | "month" | "year";

interface CalendarStateContextValue {
  /** Persisted calendar date (survives navigation to sub-screens) */
  calendarDate: string;
  /** Update calendar date */
  setCalendarDate: (date: string) => void;
  /** Persisted calendar zoom level */
  calendarZoom: CalendarZoom;
  /** Update calendar zoom */
  setCalendarZoom: (zoom: CalendarZoom) => void;
}

const CalendarStateContext = createContext<CalendarStateContextValue | null>(null);

export function CalendarStateProvider({ children }: { children: ReactNode }) {
  const [calendarDate, setCalendarDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [calendarZoom, setCalendarZoom] = useState<CalendarZoom>("month");

  const contextValue = useMemo(() => ({
    calendarDate,
    setCalendarDate,
    calendarZoom,
    setCalendarZoom,
  }), [calendarDate, calendarZoom]);

  return (
    <CalendarStateContext.Provider value={contextValue}>
      {children}
    </CalendarStateContext.Provider>
  );
}

export function useCalendarState(): CalendarStateContextValue {
  const context = useContext(CalendarStateContext);
  if (!context) {
    throw new Error("useCalendarState must be used within a CalendarStateProvider");
  }
  return context;
}
