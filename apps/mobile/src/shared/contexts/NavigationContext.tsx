import { createContext, useContext, ReactNode } from "react";

/**
 * BeforeBackHandler returns a Promise that resolves to:
 * - true: proceed with back navigation
 * - false: block back navigation (e.g., user cancelled)
 */
export type BeforeBackHandler = () => Promise<boolean>;

interface NavigationContextValue {
  navigate: (tabId: string, params?: Record<string, any>) => void;
  setBeforeBackHandler: (handler: BeforeBackHandler | null) => void;
  checkBeforeBack: () => Promise<boolean>;
  /** Track if a fullscreen modal is open (disables swipe-back gesture) */
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

interface NavigationProviderProps {
  children: ReactNode;
  navigate: (tabId: string, params?: Record<string, any>) => void;
  setBeforeBackHandler: (handler: BeforeBackHandler | null) => void;
  checkBeforeBack: () => Promise<boolean>;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

export function NavigationProvider({
  children,
  navigate,
  setBeforeBackHandler,
  checkBeforeBack,
  isModalOpen,
  setIsModalOpen,
}: NavigationProviderProps) {
  return (
    <NavigationContext.Provider value={{ navigate, setBeforeBackHandler, checkBeforeBack, isModalOpen, setIsModalOpen }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
}
