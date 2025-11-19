import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "../shared/contexts/AuthContext";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { TopBar } from "../components/layout/TopBar";
import Svg, { Path } from "react-native-svg";
import { syncQueue } from "../shared/sync/syncQueue";
import { useState } from "react";

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      console.log('🔄 Syncing before sign out...');

      // Try to sync all unsaved changes before signing out
      await syncQueue.sync();

      console.log('✅ Sync complete, signing out...');
      await signOut();
    } catch (error) {
      console.error('❌ Error during sign out:', error);

      // Ask user if they still want to sign out despite sync failure
      Alert.alert(
        'Sync Failed',
        'Could not sync your changes. Sign out anyway? Unsaved changes may be lost.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setIsSigningOut(false),
          },
          {
            text: 'Sign Out Anyway',
            style: 'destructive',
            onPress: async () => {
              await signOut();
              setIsSigningOut(false);
            },
          },
        ]
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopBar
        title="Profile"
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

      <ScrollView style={styles.content}>
        {/* User Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || "Not available"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoValue}>{user?.id || "Not available"}</Text>
          </View>
        </View>

        {/* Settings Placeholder */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          <Text style={styles.cardDescription}>
            Settings and preferences will be available here soon.
          </Text>
        </View>

        {/* Developer Tools */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Developer Tools</Text>
          <TouchableOpacity
            style={styles.devButton}
            onPress={() => navigate("location-builder")}
            activeOpacity={0.7}
          >
            <Text style={styles.devButtonText}>🗺️ Location Builder</Text>
            <Text style={styles.devButtonSubtext}>Explore Mapbox geocoding API</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutButton, isSigningOut && styles.signOutButtonDisabled]}
          onPress={handleSignOut}
          activeOpacity={0.7}
          disabled={isSigningOut}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
            <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.signOutText}>
            {isSigningOut ? "Syncing & Signing Out..." : "Sign Out"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  cardDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: "#1f2937",
  },
  devButton: {
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  devButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  devButtonSubtext: {
    fontSize: 12,
    color: "#6b7280",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  signOutButtonDisabled: {
    backgroundColor: "#9ca3af",
    opacity: 0.7,
  },
  signOutText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
