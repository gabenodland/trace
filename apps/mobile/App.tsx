import { useState, useEffect, useRef, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, ActivityIndicator, Platform, StatusBar, BackHandler, Alert } from "react-native";
import { useFonts, MavenPro_400Regular, MavenPro_500Medium, MavenPro_600SemiBold, MavenPro_700Bold } from "@expo-google-fonts/maven-pro";
import * as Linking from "expo-linking";
import { setSession } from "@trace/core";
import { AuthProvider, useAuth } from "./src/shared/contexts/AuthContext";
import { NavigationProvider, BeforeBackHandler } from "./src/shared/contexts/NavigationContext";
import { SettingsProvider } from "./src/shared/contexts/SettingsContext";
import LoginScreen from "./src/modules/auth/screens/LoginScreen";
import SignUpScreen from "./src/modules/auth/screens/SignUpScreen";
import { EntryScreen } from "./src/screens/EntryScreen";
import { EntryListScreen } from "./src/screens/EntryListScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { DatabaseInfoScreen } from "./src/screens/DatabaseInfoScreen";
import { LocationsScreen } from "./src/screens/LocationsScreen";
import { MapScreen } from "./src/screens/MapScreen";
import { StreamsScreen } from "./src/screens/StreamsScreen";
import { StreamPropertiesScreen } from "./src/screens/StreamPropertiesScreen";
import { localDB } from "./src/shared/db/localDB";
import { initializeSync, destroySync } from "./src/shared/sync";
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

  // Before back handler for screens to intercept back navigation
  const beforeBackHandlerRef = useRef<BeforeBackHandler | null>(null);

  const setBeforeBackHandler = useCallback((handler: BeforeBackHandler | null) => {
    beforeBackHandlerRef.current = handler;
  }, []);

  const checkBeforeBack = useCallback(async (): Promise<boolean> => {
    if (beforeBackHandlerRef.current) {
      return await beforeBackHandlerRef.current();
    }
    return true; // No handler, proceed with back
  }, []);

  // Initialize database and sync when authenticated
  useEffect(() => {
    if (isAuthenticated && !dbInitialized) {
      console.log('🚀 Initializing offline database...');

      localDB.init()
        .then(() => {
          console.log('✅ Database initialized');
          return initializeSync(queryClient);
        })
        .then(() => {
          console.log('✅ Sync initialized');
          setDbInitialized(true);
        })
        .catch((error) => {
          console.error('❌ Failed to initialize:', error);
        });
    }

    // Cleanup on unmount
    return () => {
      if (dbInitialized) {
        destroySync();
      }
    };
  }, [isAuthenticated, dbInitialized, queryClient]);

  // Handle Android back button and iOS swipe-back gesture
  useEffect(() => {
    if (!isAuthenticated) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Check if we can go back
      if (navigationHistory.length <= 1) {
        return false; // Allow default behavior (exit app)
      }

      // Always return true to prevent default, then handle async
      handleBackAsync();
      return true;
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

  // Handle back navigation (async version that checks beforeBack handler)
  const handleBackAsync = async () => {
    if (navigationHistory.length > 1) {
      // Check if screen allows back navigation
      const canGoBack = await checkBeforeBack();
      if (!canGoBack) {
        return; // Screen blocked back navigation
      }

      // Remove current screen
      const newHistory = navigationHistory.slice(0, -1);
      setNavigationHistory(newHistory);

      // Navigate to previous screen
      const previous = newHistory[newHistory.length - 1];
      setActiveTab(previous.tabId);
      setNavParams(previous.params);
    }
  };

  // Render the active screen
  const renderScreen = () => {
    switch (activeTab) {
      case "capture":
        return (
          <EntryScreen
            entryId={navParams.entryId}
            initialStreamId={navParams.initialStreamId}
            initialStreamName={navParams.initialStreamName}
            initialContent={navParams.initialContent}
            initialDate={navParams.initialDate}
            initialLocation={navParams.initialLocation}
            returnContext={navParams.returnContext}
            copiedEntryData={navParams.copiedEntryData}
          />
        );
      case "inbox":
        return (
          <EntryListScreen
            returnStreamId={navParams.returnStreamId}
            returnStreamName={navParams.returnStreamName}
          />
        );
      case "calendar":
        return <CalendarScreen returnDate={navParams.returnDate} />;
      case "tasks":
        return <TasksScreen />;
      case "profile":
        return <ProfileScreen />;
      case "debug":
        return <DatabaseInfoScreen />;
      case "locations":
        return <LocationsScreen />;
      case "map":
        return <MapScreen />;
      case "streams":
        return <StreamsScreen />;
      case "stream-properties":
        return <StreamPropertiesScreen streamId={navParams.streamId} />;
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
            returnStreamId={navParams.returnStreamId}
            returnStreamName={navParams.returnStreamName}
          />
        );
    }
  };

  // User is authenticated - show main app with new navigation
  return (
    <NavigationProvider
      navigate={handleNavigate}
      setBeforeBackHandler={setBeforeBackHandler}
      checkBeforeBack={checkBeforeBack}
    >
      <View style={styles.appContainer}>
        {/* Active Screen */}
        {renderScreen()}

        <ExpoStatusBar style="dark" />
      </View>
    </NavigationProvider>
  );
}

/**
 * Handle deep link URL for auth callbacks (email confirmation, password reset, etc.)
 */
async function handleAuthDeepLink(url: string): Promise<boolean> {
  console.log("[DeepLink] Received URL:", url);

  // Check if this is an auth callback
  if (!url.includes("access_token") && !url.includes("refresh_token") && !url.includes("error")) {
    return false; // Not an auth URL
  }

  try {
    let access_token: string | null = null;
    let refresh_token: string | null = null;

    // Check for fragment-based tokens (#access_token=...)
    if (url.includes("#")) {
      const fragment = url.split("#")[1];
      const params = new URLSearchParams(fragment);
      access_token = params.get("access_token");
      refresh_token = params.get("refresh_token");
    }

    // Check query params if not in fragment (?access_token=...)
    if (!access_token && url.includes("?")) {
      const urlObj = new URL(url);
      access_token = urlObj.searchParams.get("access_token");
      refresh_token = urlObj.searchParams.get("refresh_token");
    }

    if (access_token) {
      console.log("[DeepLink] Setting session from deep link");
      await setSession(access_token, refresh_token);
      Alert.alert("Success", "Your email has been confirmed! You are now signed in.");
      return true;
    }

    // Check for errors
    if (url.includes("error")) {
      const urlObj = new URL(url.replace("#", "?"));
      const error = urlObj.searchParams.get("error_description") || urlObj.searchParams.get("error");
      if (error) {
        Alert.alert("Error", decodeURIComponent(error));
        return true;
      }
    }
  } catch (error) {
    console.error("[DeepLink] Error handling auth URL:", error);
  }

  return false;
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

  // Handle deep links for auth callbacks
  useEffect(() => {
    // Handle URL that launched the app
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleAuthDeepLink(url);
      }
    });

    // Handle URLs while app is open
    const subscription = Linking.addEventListener("url", (event) => {
      handleAuthDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
      <SettingsProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </SettingsProvider>
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
