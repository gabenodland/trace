import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, ActivityIndicator, Platform, StatusBar, BackHandler } from "react-native";
import { useFonts, MavenPro_400Regular, MavenPro_500Medium, MavenPro_600SemiBold, MavenPro_700Bold } from "@expo-google-fonts/maven-pro";
import { AuthProvider, useAuth } from "./src/shared/contexts/AuthContext";
import { NavigationProvider } from "./src/shared/contexts/NavigationContext";
import LoginScreen from "./src/modules/auth/screens/LoginScreen";
import SignUpScreen from "./src/modules/auth/screens/SignUpScreen";
import { EntryScreen } from "./src/screens/EntryScreen";
import { EntryListScreen } from "./src/screens/EntryListScreen";
import { CategoriesScreen } from "./src/screens/CategoriesScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { DatabaseInfoScreen } from "./src/screens/DatabaseInfoScreen";
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
interface NavigationHistoryItem {
  tabId: string;
  params: Record<string, any>;
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");
  const [navParams, setNavParams] = useState<Record<string, any>>({});
  const [dbInitialized, setDbInitialized] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryItem[]>([
    { tabId: "inbox", params: {} }
  ]);
  const [LocationBuilderComponent, setLocationBuilderComponent] = useState<any>(null);

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

  // Handle Android back button
  useEffect(() => {
    if (!isAuthenticated) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return handleBack();
    });

    return () => backHandler.remove();
  }, [isAuthenticated, navigationHistory]);

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

    // Add to navigation history
    setNavigationHistory(prev => [...prev, { tabId, params: params || {} }]);
  };

  // Handle back navigation
  const handleBack = () => {
    if (navigationHistory.length > 1) {
      // Remove current screen
      const newHistory = navigationHistory.slice(0, -1);
      setNavigationHistory(newHistory);

      // Navigate to previous screen
      const previous = newHistory[newHistory.length - 1];
      setActiveTab(previous.tabId);
      setNavParams(previous.params);

      return true; // Handled
    }
    return false; // Not handled, allow default behavior (exit app)
  };

  // Render the active screen
  const renderScreen = () => {
    switch (activeTab) {
      case "capture":
        return (
          <EntryScreen
            entryId={navParams.entryId}
            initialCategoryId={navParams.initialCategoryId}
            initialCategoryName={navParams.initialCategoryName}
            initialContent={navParams.initialContent}
            initialDate={navParams.initialDate}
            returnContext={navParams.returnContext}
          />
        );
      case "inbox":
        return (
          <EntryListScreen
            returnCategoryId={navParams.returnCategoryId}
            returnCategoryName={navParams.returnCategoryName}
          />
        );
      case "categories":
        return <CategoriesScreen />;
      case "calendar":
        return <CalendarScreen returnDate={navParams.returnDate} />;
      case "tasks":
        return <TasksScreen />;
      case "profile":
        return <ProfileScreen />;
      case "debug":
        return <DatabaseInfoScreen />;
      case "location-builder":
        // Dynamically load LocationBuilderScreen to avoid loading MapView at startup
        if (!LocationBuilderComponent) {
          import('./src/modules/locations/screens/LocationBuilderScreen').then(module => {
            setLocationBuilderComponent(() => module.LocationBuilderScreen);
          });
          return (
            <View style={styles.container}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          );
        }
        return <LocationBuilderComponent />;
      default:
        return (
          <EntryListScreen
            returnCategoryId={navParams.returnCategoryId}
            returnCategoryName={navParams.returnCategoryName}
          />
        );
    }
  };

  // User is authenticated - show main app with new navigation
  return (
    <NavigationProvider navigate={handleNavigate}>
      <View style={styles.appContainer}>
        {/* Active Screen */}
        {renderScreen()}

        <ExpoStatusBar style="dark" />
      </View>
    </NavigationProvider>
  );
}

/**
 * Root App Component
 */
export default function App() {
  const [fontsLoaded] = useFonts({
    MavenPro_400Regular,
    MavenPro_500Medium,
    MavenPro_600SemiBold,
    MavenPro_700Bold,
  });

  // Show loading while fonts are loading
  if (!fontsLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
        <ExpoStatusBar style="dark" />
      </View>
    );
  }

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
