import { useState, useEffect, useRef, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, ActivityIndicator, BackHandler, Alert, Animated } from "react-native";
import { useFonts } from "expo-font";
// Theme fonts - all loaded upfront, user selects independently of theme
import { MavenPro_400Regular, MavenPro_500Medium, MavenPro_600SemiBold, MavenPro_700Bold } from "@expo-google-fonts/maven-pro";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { Lora_400Regular, Lora_500Medium, Lora_600SemiBold, Lora_700Bold } from "@expo-google-fonts/lora";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from "@expo-google-fonts/atkinson-hyperlegible";
// New fonts
import { Newsreader_400Regular, Newsreader_500Medium, Newsreader_600SemiBold, Newsreader_700Bold } from "@expo-google-fonts/newsreader";
import { Oxanium_400Regular, Oxanium_500Medium, Oxanium_600SemiBold, Oxanium_700Bold } from "@expo-google-fonts/oxanium";
import { Play_400Regular, Play_700Bold } from "@expo-google-fonts/play";
import { Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from "@expo-google-fonts/roboto";
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from "@expo-google-fonts/nunito";
import { OpenSans_400Regular, OpenSans_500Medium, OpenSans_600SemiBold, OpenSans_700Bold } from "@expo-google-fonts/open-sans";
import { Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from "@expo-google-fonts/montserrat";
import { Raleway_400Regular, Raleway_500Medium, Raleway_600SemiBold, Raleway_700Bold } from "@expo-google-fonts/raleway";
import { Exo2_400Regular, Exo2_500Medium, Exo2_600SemiBold, Exo2_700Bold } from "@expo-google-fonts/exo-2";
import * as Linking from "expo-linking";
import { setSession } from "@trace/core";
import { AuthProvider, useAuth } from "./src/shared/contexts/AuthContext";
import { NavigationProvider, BeforeBackHandler, useNavigation } from "./src/shared/contexts/NavigationContext";
import { SettingsProvider } from "./src/shared/contexts/SettingsContext";
import { ThemeProvider, useTheme } from "./src/shared/contexts/ThemeContext";
import { DrawerProvider, useDrawer, type ViewMode } from "./src/shared/contexts/DrawerContext";
import { StreamDrawer } from "./src/components/drawer";
import { useSwipeBackGesture } from "./src/shared/hooks/useSwipeBackGesture";
import { ErrorBoundary } from "./src/shared/components/ErrorBoundary";
import LoginScreen from "./src/modules/auth/screens/LoginScreen";
import SignUpScreen from "./src/modules/auth/screens/SignUpScreen";
import { EntryScreen } from "./src/modules/entries/components/EntryScreen";
import { EntryListScreen } from "./src/screens/EntryListScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { DatabaseInfoScreen } from "./src/screens/DatabaseInfoScreen";
import { LocationsScreen } from "./src/screens/LocationsScreen";
import { MapScreen } from "./src/screens/MapScreen";
import { StreamsScreen } from "./src/screens/StreamsScreen";
import { StreamPropertiesScreen } from "./src/screens/StreamPropertiesScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
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
 *
 * Navigation is simple:
 * - Main views (list/map/calendar) are tracked via DrawerContext.viewMode
 * - Sub-screens (entry, settings, profile) just track current screen
 * - Back from any sub-screen returns to the main view
 * - No history stack needed
 */
function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");
  const [navParams, setNavParams] = useState<Record<string, any>>({});
  const [dbInitialized, setDbInitialized] = useState(false);

  // Before back handler for screens to intercept back navigation
  const beforeBackHandlerRef = useRef<BeforeBackHandler | null>(null);

  // Track if a fullscreen modal is open (disables swipe-back gesture)
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Ref to store current main view screen (updated by AppContent based on viewMode)
  const mainViewScreenRef = useRef<string>("inbox");

  const setBeforeBackHandler = useCallback((handler: BeforeBackHandler | null) => {
    beforeBackHandlerRef.current = handler;
  }, []);

  const checkBeforeBack = useCallback(async (): Promise<boolean> => {
    if (beforeBackHandlerRef.current) {
      return await beforeBackHandlerRef.current();
    }
    return true; // No handler, proceed with back
  }, []);

  // Callback for AppContent to update main view screen based on viewMode
  const setMainViewScreen = useCallback((screen: string) => {
    mainViewScreenRef.current = screen;
  }, []);

  // Track current activeTab via ref for use in stable callbacks
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Main view screens - back from these exits app
  const mainViewScreens = ["inbox", "map", "calendar"];

  // Handle back navigation - always returns to main view
  // Using refs to avoid recreating callback when state changes
  const handleBackAsync = useCallback(async () => {
    const isOnMainView = mainViewScreens.includes(activeTabRef.current);
    if (isOnMainView) return; // Already on main view

    // Check if screen allows back navigation
    const canGoBack = await checkBeforeBack();
    if (!canGoBack) {
      return; // Screen blocked back navigation
    }

    // Go back to main view using the current viewMode
    setNavParams({});
    setActiveTab(mainViewScreenRef.current);
  }, [checkBeforeBack]);

  // Handle navigation - simple screen change, no history stack
  const handleNavigate = useCallback((tabId: string, params?: Record<string, any>) => {
    // Handle "back" navigation specially - go to main view
    if (tabId === "back") {
      handleBackAsync();
      return;
    }
    setActiveTab(tabId);
    setNavParams(params || {});
  }, [handleBackAsync]);

  // Track initialization state to prevent duplicate initialization
  const hasInitializedRef = useRef(false);

  // Initialize database and sync when authenticated
  useEffect(() => {
    // Not authenticated - ensure cleanup
    if (!isAuthenticated) {
      if (hasInitializedRef.current) {
        destroySync();
        hasInitializedRef.current = false;
        setDbInitialized(false);
      }
      return;
    }

    // Already initialized - skip
    if (hasInitializedRef.current) {
      return;
    }

    // Initialize for the first time
    hasInitializedRef.current = true;

    localDB.init()
      .then(() => {
        setDbInitialized(true);
        return initializeSync(queryClient);
      })
      .catch((error) => {
        console.error('Failed to initialize:', error);
        hasInitializedRef.current = false;
      });
  }, [isAuthenticated]);

  // Compute isOnMainView for backHandler effect
  const isOnMainView = mainViewScreens.includes(activeTab);

  // Handle Android back button and iOS swipe-back gesture
  useEffect(() => {
    if (!isAuthenticated) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If on main view, allow default behavior (exit app)
      if (isOnMainView) {
        return false;
      }

      // On sub-screen, go back to main view
      handleBackAsync();
      return true;
    });

    return () => backHandler.remove();
  }, [isAuthenticated, isOnMainView]);

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

  // User is authenticated - show main app with new navigation
  return (
    <DrawerProvider>
      <NavigationProvider
        navigate={handleNavigate}
        setBeforeBackHandler={setBeforeBackHandler}
        checkBeforeBack={checkBeforeBack}
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
      >
        <AppContent
          activeTab={activeTab}
          navParams={navParams}
          setMainViewScreen={setMainViewScreen}
        />
      </NavigationProvider>
    </DrawerProvider>
  );
}

/**
 * AppContent - Inner component that uses drawer context
 * Handles view mode changes and renders the app content
 *
 * Main view screens (inbox, map, calendar) stay mounted for instant back navigation.
 * Sub-screens (capture, settings, etc.) mount/unmount as needed.
 *
 * Swipe-back gesture: When on a sub-screen, swiping right from anywhere brings
 * the main view sliding in from the left (iOS-style back navigation).
 */
interface AppContentProps {
  activeTab: string;
  navParams: Record<string, any>;
  setMainViewScreen: (screen: string) => void;
}

function AppContent({ activeTab, navParams, setMainViewScreen }: AppContentProps) {
  const { navigate, checkBeforeBack, isModalOpen } = useNavigation();
  const { registerViewModeHandler, viewMode } = useDrawer();
  const theme = useTheme();

  // Map viewMode to screen name
  const screenMap: Record<ViewMode, string> = {
    list: "inbox",
    map: "map",
    calendar: "calendar",
  };

  // Main view screens that stay mounted
  const mainViewScreens = ["inbox", "map", "calendar"];
  const isOnMainView = mainViewScreens.includes(activeTab);

  // Debug logging for paint timing investigation
  console.log(`🖼️ [AppContent] Render: activeTab=${activeTab}, isOnMainView=${isOnMainView}`);

  // Target main view for swipe-back (the screen we came from)
  const targetMainView = screenMap[viewMode];

  // Stable callback for swipe-back navigation
  const handleSwipeBack = useCallback(() => {
    navigate(targetMainView);
  }, [navigate, targetMainView]);

  // Swipe-back gesture - extracted to hook for cleaner code
  // Disabled when a fullscreen modal (like LocationPicker) is open
  const { panHandlers, mainViewTranslateX, isSwipingBack } = useSwipeBackGesture({
    isEnabled: !isOnMainView,
    onBack: handleSwipeBack,
    checkBeforeBack,
    isModalOpen,
  });

  // Debug: Log what the Animated.View will render with
  console.log(`🖼️ [AppContent] After hook: isSwipingBack=${isSwipingBack}`);

  // Keep main view screen ref in sync with viewMode
  useEffect(() => {
    setMainViewScreen(screenMap[viewMode]);
  }, [viewMode, setMainViewScreen]);

  // Register view mode handler to navigate when mode changes
  useEffect(() => {
    registerViewModeHandler((mode: ViewMode) => {
      navigate(screenMap[mode]);
    });
    return () => registerViewModeHandler(null);
  }, [registerViewModeHandler, navigate]);

  // Helper: should a main view be visible?
  const shouldShowMainView = (viewName: string) => {
    if (isOnMainView) {
      // On main view - show only the active one
      return activeTab === viewName;
    } else {
      // On sub-screen - show only the target during swipe
      return isSwipingBack && targetMainView === viewName;
    }
  };

  // Render sub-screen if not on main view
  const renderSubScreen = () => {
    let content: React.ReactNode = null;
    let boundaryName = activeTab;

    switch (activeTab) {
      case "capture":
        boundaryName = "EntryScreen";
        content = (
          <EntryScreen
            entryId={navParams.entryId}
            initialStreamId={navParams.initialStreamId}
            initialStreamName={navParams.initialStreamName}
            initialContent={navParams.initialContent}
            initialDate={navParams.initialDate}
          />
        );
        break;
      case "profile":
        boundaryName = "ProfileScreen";
        content = <ProfileScreen />;
        break;
      case "settings":
        boundaryName = "SettingsScreen";
        content = <SettingsScreen />;
        break;
      case "debug":
        boundaryName = "DatabaseInfoScreen";
        content = <DatabaseInfoScreen />;
        break;
      case "locations":
        boundaryName = "LocationsScreen";
        content = <LocationsScreen />;
        break;
      case "streams":
        boundaryName = "StreamsScreen";
        content = <StreamsScreen />;
        break;
      case "stream-properties":
        boundaryName = "StreamPropertiesScreen";
        content = <StreamPropertiesScreen streamId={navParams.streamId} />;
        break;
      default:
        return null;
    }

    return (
      <ErrorBoundary name={boundaryName} onBack={() => navigate(targetMainView)}>
        {content}
      </ErrorBoundary>
    );
  };

  return (
    <View
      style={[styles.appContainer, { backgroundColor: theme.colors.background.secondary }]}
      {...panHandlers}
    >
      {/* Sub-screen layer - rendered FIRST when on sub-screen (bottom layer) */}
      {!isOnMainView && (
        <View style={[styles.screenLayer, { backgroundColor: theme.colors.background.secondary }]} pointerEvents={isSwipingBack ? "none" : "auto"}>
          {renderSubScreen()}
        </View>
      )}

      {/* Main views layer - slides in from left during swipe-back */}
      {/* When on main view: translateX = 0 (visible) */}
      {/* When on sub-screen: translateX = -screenWidth (off-screen), slides to 0 during swipe */}
      <Animated.View
        style={[
          styles.screenLayer,
          {
            backgroundColor: theme.colors.background.secondary,
            transform: [{ translateX: isOnMainView ? 0 : mainViewTranslateX }],
            // Shadow on right edge when sliding in
            shadowColor: "#000",
            shadowOffset: { width: 4, height: 0 },
            shadowOpacity: isSwipingBack ? 0.15 : 0,
            shadowRadius: 8,
            elevation: isSwipingBack ? 16 : 0,
          },
        ]}
        pointerEvents={isOnMainView ? "auto" : (isSwipingBack ? "auto" : "none")}
      >
        <View
          style={[
            styles.screenLayer,
            { backgroundColor: theme.colors.background.secondary },
            !shouldShowMainView("inbox") && styles.screenHidden,
          ]}
          pointerEvents={activeTab === "inbox" ? "auto" : "none"}
        >
          <ErrorBoundary name="EntryListScreen">
            <EntryListScreen />
          </ErrorBoundary>
        </View>
        <View
          style={[
            styles.screenLayer,
            { backgroundColor: theme.colors.background.secondary },
            !shouldShowMainView("map") && styles.screenHidden,
          ]}
          pointerEvents={activeTab === "map" ? "auto" : "none"}
        >
          <ErrorBoundary name="MapScreen">
            <MapScreen isVisible={activeTab === "map"} />
          </ErrorBoundary>
        </View>
        <View
          style={[
            styles.screenLayer,
            { backgroundColor: theme.colors.background.secondary },
            !shouldShowMainView("calendar") && styles.screenHidden,
          ]}
          pointerEvents={activeTab === "calendar" ? "auto" : "none"}
        >
          <ErrorBoundary name="CalendarScreen">
            <CalendarScreen />
          </ErrorBoundary>
        </View>
      </Animated.View>

      {/* Stream Drawer - renders as overlay */}
      <StreamDrawer />

      <ExpoStatusBar style={theme.isDark ? "light" : "dark"} />
    </View>
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
    // Core fonts
    MavenPro_400Regular,
    MavenPro_500Medium,
    MavenPro_600SemiBold,
    MavenPro_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    // New fonts
    Newsreader_400Regular,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    Oxanium_400Regular,
    Oxanium_500Medium,
    Oxanium_600SemiBold,
    Oxanium_700Bold,
    Play_400Regular,
    Play_700Bold,
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Raleway_400Regular,
    Raleway_500Medium,
    Raleway_600SemiBold,
    Raleway_700Bold,
    Exo2_400Regular,
    Exo2_500Medium,
    Exo2_600SemiBold,
    Exo2_700Bold,
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
        <ThemeProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </ThemeProvider>
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
  screenLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#f9fafb",
  },
  screenHidden: {
    opacity: 0,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
});
