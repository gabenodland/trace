// Initialize core FIRST - before any other @trace/core imports

// Initialize core FIRST - before any other @trace/core imports
import "./src/config/initializeCore";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, ActivityIndicator, BackHandler, Alert, Animated, Linking as RNLinking, Modal, TouchableOpacity } from "react-native";
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
import { AccountScreen } from "./src/screens/AccountScreen";
import { DatabaseInfoScreen } from "./src/screens/DatabaseInfoScreen";
import { EditorTestScreen } from "./src/screens/EditorTestScreen";
import { LocationsScreen } from "./src/screens/LocationsScreen";
import { MapScreen } from "./src/screens/MapScreen";
import { StreamsScreen } from "./src/screens/StreamsScreen";
import { StreamPropertiesScreen } from "./src/screens/StreamPropertiesScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { SubscriptionScreen } from "./src/screens/SubscriptionScreen";
import { localDB } from "./src/shared/db/localDB";
import { initializeSync, destroySync } from "./src/shared/sync";
import "./src/shared/db/dbDebug"; // Global debug utilities
import { checkAppVersion, logAppSession, VersionStatus } from "./src/config/appVersionService";

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
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");
  const [navParams, setNavParams] = useState<Record<string, any>>({});
  const [dbInitialized, setDbInitialized] = useState(false);

  // Version check state
  const [versionStatus, setVersionStatus] = useState<VersionStatus | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

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

    const dbStart = Date.now();
    localDB.init()
      .then(() => {
        console.log(`⏱️ 3_localDB.init: ${Date.now() - dbStart}ms`);
        setDbInitialized(true);
        const syncStart = Date.now();
        return initializeSync(queryClient).then(() => {
          console.log(`⏱️ 4_initializeSync: ${Date.now() - syncStart}ms`);
        });
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

  // Check app version on startup
  useEffect(() => {
    checkAppVersion().then((status) => {
      setVersionStatus(status);
      if (status.status === 'force_update' || status.status === 'update_available') {
        setShowUpdateModal(true);
      }
    });
  }, []);

  // Log session when user authenticates
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      logAppSession(user.id);
    }
  }, [isAuthenticated, user?.id]);

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

  // Handle update button press
  const handleUpdatePress = () => {
    if (versionStatus && versionStatus.status !== 'ok' && versionStatus.status !== 'error') {
      RNLinking.openURL(versionStatus.url);
    }
  };

  // User is authenticated - show main app with new navigation
  return (
    <>
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

      {/* Update Modal */}
      <Modal
        visible={showUpdateModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          // Only allow closing for non-force updates
          if (versionStatus?.status === 'update_available') {
            setShowUpdateModal(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {versionStatus?.status === 'force_update' ? 'Update Required' : 'Update Available'}
            </Text>
            <Text style={styles.modalMessage}>
              {versionStatus?.status !== 'ok' && versionStatus?.status !== 'error' && versionStatus?.message}
            </Text>
            <TouchableOpacity style={styles.updateButton} onPress={handleUpdatePress}>
              <Text style={styles.updateButtonText}>Update Now</Text>
            </TouchableOpacity>
            {versionStatus?.status === 'update_available' && (
              <TouchableOpacity
                style={styles.laterButton}
                onPress={() => setShowUpdateModal(false)}
              >
                <Text style={styles.laterButtonText}>Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
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

  // Track if sub-screen has been laid out (for z-order control)
  // Once laid out, we flip z-order so main view is on top for swipe-back
  const [subScreenReady, setSubScreenReady] = useState(false);

  // Track the last main view for swipe-back navigation
  // This remembers which main tab (inbox/map/calendar) the user was on
  const [lastMainView, setLastMainView] = useState<string>("inbox");

  // Update lastMainView when on a main view, reset subScreenReady
  useEffect(() => {
    if (isOnMainView) {
      setSubScreenReady(false);
      setLastMainView(activeTab);
    }
  }, [isOnMainView, activeTab]);

  // Callback for when sub-screen layout completes
  const handleSubScreenLayout = useCallback(() => {
    if (!subScreenReady) {
      setSubScreenReady(true);
    }
  }, [subScreenReady]);

  // Target main view for swipe-back (the screen we came from)
  const targetMainView = lastMainView;

  // Stable callback for swipe-back navigation
  const handleSwipeBack = useCallback(() => {
    navigate(targetMainView);
  }, [navigate, targetMainView]);

  // Swipe-back gesture - extracted to hook for cleaner code
  // Disabled when a fullscreen modal (like LocationPicker) is open
  const { panHandlers, mainViewTranslateX } = useSwipeBackGesture({
    isEnabled: !isOnMainView,
    onBack: handleSwipeBack,
    checkBeforeBack,
    isModalOpen,
  });

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
      // On sub-screen - ALWAYS show the target main view
      // It's off-screen due to translateX, but keeping it visible (opacity: 1)
      // ensures Android renders it and it's ready for instant swipe-back
      return targetMainView === viewName;
    }
  };

  // Memoize sub-screen content to prevent re-renders during swipe gesture
  const subScreenContent = useMemo(() => {
    if (isOnMainView) return null;

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
      case "account":
        boundaryName = "AccountScreen";
        content = <AccountScreen />;
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
      case "editorTest":
        boundaryName = "EditorTestScreen";
        content = <EditorTestScreen />;
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
      case "subscription":
        boundaryName = "SubscriptionScreen";
        content = <SubscriptionScreen />;
        break;
      default:
        return null;
    }

    return (
      <ErrorBoundary name={boundaryName} onBack={() => navigate(targetMainView)}>
        {content}
      </ErrorBoundary>
    );
  }, [activeTab, navParams, targetMainView, navigate, isOnMainView]);

  return (
    <View
      style={[styles.appContainer, { backgroundColor: theme.colors.background.secondary }]}
      {...panHandlers}
    >
      {/* Main views layer - slides in from left during swipe-back */}
      {/* Rendered FIRST (bottom layer) so sub-screen is always on top */}
      <Animated.View
        style={[
          styles.screenLayer,
          {
            backgroundColor: theme.colors.background.secondary,
            transform: [{ translateX: isOnMainView ? 0 : mainViewTranslateX }],
            // After sub-screen renders, put main view on top for swipe-back
            zIndex: subScreenReady ? 2 : 0,
          },
        ]}
        pointerEvents={isOnMainView ? "auto" : "none"}
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

      {/* Sub-screen layer - on top initially, then below main view after it's laid out */}
      {/* zIndex 1 keeps it below main view (zIndex 2) after subScreenReady */}
      {!isOnMainView && (
        <View
          style={[styles.screenLayer, { backgroundColor: theme.colors.background.secondary, zIndex: 1 }]}
          pointerEvents="auto"
          onLayout={handleSubScreenLayout}
        >
          {subScreenContent}
        </View>
      )}

      {/* Stream Drawer - renders as overlay (left side) */}
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
  // Track font loading time
  const fontStartTime = useRef(Date.now());

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

  // Log font loading time
  useEffect(() => {
    if (fontsLoaded) {
      console.log(`⏱️ 2_fonts: ${Date.now() - fontStartTime.current}ms (${56} font files)`);
    }
  }, [fontsLoaded]);

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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111",
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  updateButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  updateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  laterButton: {
    marginTop: 12,
    paddingVertical: 10,
  },
  laterButtonText: {
    color: "#666",
    fontSize: 16,
  },
});
