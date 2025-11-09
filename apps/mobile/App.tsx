import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, ActivityIndicator, Platform, StatusBar } from "react-native";
import { AuthProvider, useAuth } from "./src/shared/contexts/AuthContext";
import { NavigationProvider } from "./src/shared/contexts/NavigationContext";
import LoginScreen from "./src/modules/auth/screens/LoginScreen";
import SignUpScreen from "./src/modules/auth/screens/SignUpScreen";
import { HamburgerMenu } from "./src/components/navigation/HamburgerMenu";
import { FloatingActionButton } from "./src/components/navigation/FloatingActionButton";
import { CaptureScreen } from "./src/screens/CaptureScreen";
import { InboxScreen } from "./src/screens/InboxScreen";
import { CategoriesScreen } from "./src/screens/CategoriesScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { EntryEditScreen } from "./src/screens/EntryEditScreen";

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
    setActiveTab("capture");
  };

  // Render the active screen
  const renderScreen = () => {
    switch (activeTab) {
      case "capture":
        return <CaptureScreen />;
      case "inbox":
        return <InboxScreen />;
      case "entryEdit":
        return <EntryEditScreen entryId={navParams.entryId} />;
      case "categories":
        return <CategoriesScreen />;
      case "calendar":
        return <CalendarScreen />;
      case "tasks":
        return <TasksScreen />;
      default:
        return <InboxScreen />;
    }
  };

  // User is authenticated - show main app with new navigation
  return (
    <NavigationProvider navigate={handleNavigate}>
      <View style={styles.appContainer}>
        {/* Hamburger Menu */}
        <View style={styles.headerContainer}>
          <HamburgerMenu />
        </View>

        {/* Active Screen */}
        {renderScreen()}

        {/* Floating Action Button - Only show when NOT in capture or edit mode */}
        {activeTab !== "capture" && activeTab !== "entryEdit" && (
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
  headerContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 200,
    elevation: 200,
    paddingTop: Platform.OS === "ios" ? 60 : (StatusBar.currentHeight || 0) + 8,
    paddingRight: 12,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
});
