import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "./src/shared/contexts/AuthContext";
import LoginScreen from "./src/modules/auth/screens/LoginScreen";
import SignUpScreen from "./src/modules/auth/screens/SignUpScreen";
import { TabBar, TabItem } from "./src/components/navigation/TabBar";
import { CaptureScreen } from "./src/screens/CaptureScreen";
import { InboxScreen } from "./src/screens/InboxScreen";
import { CategoriesScreen } from "./src/screens/CategoriesScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { TasksScreen } from "./src/screens/TasksScreen";

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Tab configuration
const tabs: TabItem[] = [
  { id: "capture", label: "Capture", icon: "✏️" },
  { id: "inbox", label: "Inbox", icon: "📥", badge: 0 },
  { id: "categories", label: "Categories", icon: "📁" },
  { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "tasks", label: "Tasks", icon: "✓", badge: 0 },
];

/**
 * AuthGate - Shows login/signup when not authenticated, main app when authenticated
 */
function AuthGate() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);
  const [activeTab, setActiveTab] = useState("capture");

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
        <StatusBar style="dark" />
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

  // Render the active screen
  const renderScreen = () => {
    switch (activeTab) {
      case "capture":
        return <CaptureScreen />;
      case "inbox":
        return <InboxScreen />;
      case "categories":
        return <CategoriesScreen />;
      case "calendar":
        return <CalendarScreen />;
      case "tasks":
        return <TasksScreen />;
      default:
        return <CaptureScreen />;
    }
  };

  // User is authenticated - show main app with tab navigation
  return (
    <View style={styles.appContainer}>
      {renderScreen()}
      <TabBar tabs={tabs} activeTab={activeTab} onTabPress={setActiveTab} />
      <StatusBar style="dark" />
    </View>
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
