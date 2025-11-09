import { createContext, useContext, ReactNode } from "react";

interface NavigationContextValue {
  navigate: (tabId: string, params?: Record<string, any>) => void;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

interface NavigationProviderProps {
  children: ReactNode;
  navigate: (tabId: string, params?: Record<string, any>) => void;
}

export function NavigationProvider({ children, navigate }: NavigationProviderProps) {
  return (
    <NavigationContext.Provider value={{ navigate }}>
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
