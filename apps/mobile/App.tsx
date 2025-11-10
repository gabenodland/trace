import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, ActivityIndicator, Platform, StatusBar } from "react-native";
import { AuthProvider, useAuth } from "./src/shared/contexts/AuthContext";
import { NavigationProvider } from "./src/shared/contexts/NavigationContext";
import LoginScreen from "./src/modules/auth/screens/LoginScreen";
import SignUpScreen from "./src/modules/auth/screens/SignUpScreen";
import { FloatingActionButton } from "./src/components/navigation/FloatingActionButton";
import { EntryScreen } from "./src/screens/EntryScreen";
import { EntryListScreen } from "./src/screens/EntryListScreen";
import { CategoriesScreen } from "./src/screens/CategoriesScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { DebugScreen } from "./src/screens/DebugScreen";
import { localDB } from "./src/shared/db/localDB";
import { syncQueue } from "./src/shared/sync/syncQueue";
import "./src/shared/db/dbDebug"; // Global debug utilities

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * AuthGate - Shows login/signup when not authenticated, main app when authenticated
 */
function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");
  const [navParams, setNavParams] = useState<Record<string, any>>({});
  const [dbInitialized, setDbInitialized] = useState(false);

  // Initialize database and sync when authenticated
  useEffect(() => {
    if (isAuthenticated && !dbInitialized) {
      console.log('🚀 Initializing offline database...');

      localDB.init()
        .then(() => {
          console.log('✅ Database initialized');
          return syncQueue.initialize(queryClient); // Pass queryClient for cache invalidation
        })
        .then(async () => {
          console.log('✅ Sync queue initialized');

          // Note: syncQueue.initialize() already triggers an initial sync which includes pull
          // No need to manually call pullFromSupabase here
        })
        .then(() => {
          console.log('✅ Initialization complete');
          setDbInitialized(true);
        })
        .catch((error) => {
          console.error('❌ Failed to initialize:', error);
        });
    }

    // Cleanup on unmount
    return () => {
      if (dbInitialized) {
        syncQueue.destroy();
      }
    };
  }, [isAuthenticated, dbInitialized, queryClient]);

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
        <ExpoStatusBar style="dark" />
      </View>
    );
  }

  // Show login/signup screens when not authenticated
  if (!isAuthenticated) {
    if (showSignUp) {
      return <SignUpScreen onSwitchToLogin={() => setShowSignUp(false)} />;
    }
    return <LoginScreen onSwitchToSignUp={() => setShowSignUp(true)} />;
  }

  // Handle navigation
  const handleNavigate = (tabId: string, params?: Record<string, any>) => {
    setActiveTab(tabId);
    setNavParams(params || {});
  };

  // Handle FAB add action
  const handleAddPress = () => {
    setNavParams({}); // Clear any existing params
    setActiveTab("capture");
  };

  // Render the active screen
  const renderScreen = () => {
    switch (activeTab) {
      case "capture":
        return <EntryScreen entryId={navParams.entryId} />;
      case "inbox":
        return <EntryListScreen />;
      case "categories":
        return <CategoriesScreen />;
      case "calendar":
        return <CalendarScreen />;
      case "tasks":
        return <TasksScreen />;
      case "debug":
        return <DebugScreen />;
      default:
        return <EntryListScreen />;
    }
  };

  // User is authenticated - show main app with new navigation
  return (
    <NavigationProvider navigate={handleNavigate}>
      <View style={styles.appContainer}>
        {/* Active Screen */}
        {renderScreen()}

        {/* Floating Action Button - Only show when NOT in capture or categories mode */}
        {activeTab !== "capture" && activeTab !== "categories" && (
          <FloatingActionButton
            mode="add"
            onAdd={handleAddPress}
          />
        )}

        <ExpoStatusBar style="dark" />
      </View>
    </NavigationProvider>
  );
}

/**
 * Root App Component
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  appContainer: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
});
