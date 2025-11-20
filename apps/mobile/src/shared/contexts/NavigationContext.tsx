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
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

interface NavigationProviderProps {
  children: ReactNode;
  navigate: (tabId: string, params?: Record<string, any>) => void;
  setBeforeBackHandler: (handler: BeforeBackHandler | null) => void;
  checkBeforeBack: () => Promise<boolean>;
}

export function NavigationProvider({
  children,
  navigate,
  setBeforeBackHandler,
  checkBeforeBack
}: NavigationProviderProps) {
  return (
    <NavigationContext.Provider value={{ navigate, setBeforeBackHandler, checkBeforeBack }}>
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
