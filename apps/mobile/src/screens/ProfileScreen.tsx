/**
 * Profile Screen
 *
 * Full-featured profile editing with:
 * - Avatar upload/change
 * - Name editing
 * - Username editing with availability check
 * - Profile completion tracking
 * - Sign out functionality
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
} from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { useAuth } from "../shared/contexts/AuthContext";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { useSync } from "../shared/sync";
import { createScopedLogger } from "../shared/utils/logger";
import {
  useProfile,
  validateName,
  validateUsername,
  type AvatarImageInput,
} from "@trace/core";
import { AvatarPicker, UsernameInput } from "../modules/profile/components";
import type { AvatarImageData } from "../modules/profile/components/AvatarPicker";
import { theme } from "../shared/theme/theme";

const log = createScopedLogger("ProfileScreen");

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { navigate } = useNavigation();
  const { sync } = useSync();

  // Profile data - pass user.id to ensure mutations work even before profile loads
  const { profile, isLoading, error, profileMutations } = useProfile(user?.id);

  // Local form state
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Snackbar state for auto-save feedback
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const snackbarOpacity = useRef(new Animated.Value(0)).current;
  const snackbarTranslateY = useRef(new Animated.Value(-20)).current;

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setUsername(profile.username);
    }
  }, [profile]);

  // Show snackbar with pop-down animation
  const showSnackbar = useCallback((message: string) => {
    setSnackbarMessage(message);
    // Reset position
    snackbarTranslateY.setValue(-20);
    snackbarOpacity.setValue(0);

    Animated.sequence([
      // Pop down
      Animated.parallel([
        Animated.timing(snackbarOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(snackbarTranslateY, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // Hold
      Animated.delay(1500),
      // Pop away
      Animated.parallel([
        Animated.timing(snackbarOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(snackbarTranslateY, {
          toValue: -20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => setSnackbarMessage(null));
  }, [snackbarOpacity, snackbarTranslateY]);

  // Handle name change
  const handleNameChange = useCallback((text: string) => {
    setName(text);
  }, []);

  // Handle username change
  const handleUsernameChange = useCallback((text: string) => {
    setUsername(text);
  }, []);

  // Auto-save name on blur
  const handleNameBlur = useCallback(async () => {
    const trimmedName = name.trim();

    // Skip if empty or unchanged
    if (!trimmedName) return;
    if (profile && trimmedName === profile.name) return;

    // Validate
    const validation = validateName(trimmedName);
    if (!validation.isValid) {
      Alert.alert("Invalid Name", validation.error);
      return;
    }

    try {
      log.info("Auto-saving name", { name: trimmedName });
      await profileMutations.updateProfile({
        name: trimmedName,
        profile_complete: true,
      });
      showSnackbar("Name saved");
    } catch (error: any) {
      log.error("Name save failed", error);
      Alert.alert("Save Failed", error.message || "Failed to save name");
    }
  }, [name, profile, profileMutations, showSnackbar]);

  // Auto-save username on blur
  const handleUsernameBlur = useCallback(async () => {
    const trimmedUsername = username.trim();

    // Skip if empty or unchanged
    if (!trimmedUsername) return;
    if (profile && trimmedUsername === profile.username) return;

    // Validate format
    const validation = validateUsername(trimmedUsername);
    if (!validation.isValid) {
      Alert.alert("Invalid Username", validation.error);
      return;
    }

    // Check availability
    try {
      const isAvailable = await profileMutations.checkUsername(trimmedUsername);
      if (!isAvailable) {
        Alert.alert("Username Taken", "This username is already in use");
        return;
      }
    } catch (error) {
      log.error("Username check failed", error);
      Alert.alert("Error", "Could not verify username availability");
      return;
    }

    try {
      log.info("Auto-saving username", { username: trimmedUsername });
      await profileMutations.updateProfile({
        username: trimmedUsername,
        profile_complete: true,
      });
      showSnackbar("Username saved");
    } catch (error: any) {
      log.error("Username save failed", error);
      Alert.alert("Save Failed", error.message || "Failed to save username");
    }
  }, [username, profile, profileMutations, showSnackbar]);

  // Check username availability
  const handleCheckUsername = useCallback(
    async (usernameToCheck: string): Promise<boolean> => {
      try {
        return await profileMutations.checkUsername(usernameToCheck);
      } catch (error) {
        log.error("Username check failed", error);
        return false;
      }
    },
    [profileMutations]
  );

  // Handle avatar selection
  const handleAvatarSelected = useCallback(
    async (imageData: AvatarImageData) => {
      try {
        log.info("Uploading avatar");

        const avatarInput: AvatarImageInput = {
          uri: imageData.uri,
          base64: imageData.base64,
          type: imageData.type,
          name: "avatar.jpg",
        };

        await profileMutations.uploadAvatar(avatarInput);
        log.success("Avatar uploaded");
        showSnackbar("Photo saved");
      } catch (error: any) {
        log.error("Avatar upload failed", error);
        Alert.alert("Upload Failed", error.message || "Failed to upload avatar");
      }
    },
    [profileMutations, showSnackbar]
  );

  // Handle avatar removal
  const handleAvatarRemoved = useCallback(async () => {
    try {
      log.info("Removing avatar");
      await profileMutations.deleteAvatar();
      log.success("Avatar removed");
      showSnackbar("Photo removed");
    } catch (error: any) {
      log.error("Avatar removal failed", error);
      Alert.alert("Remove Failed", error.message || "Failed to remove avatar");
    }
  }, [profileMutations, showSnackbar]);

  // Handle sign out
  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      log.info("Syncing before sign out");

      await sync();

      log.success("Sync complete, signing out");
      await signOut();
    } catch (error) {
      log.error("Error during sign out", error);

      Alert.alert(
        "Sync Failed",
        "Could not sync your changes. Sign out anyway? Unsaved changes may be lost.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setIsSigningOut(false),
          },
          {
            text: "Sign Out Anyway",
            style: "destructive",
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

  // Loading state
  if (isLoading && !profile) {
    return (
      <View style={styles.container}>
        <SecondaryHeader title="Profile" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error && !profile) {
    return (
      <View style={styles.container}>
        <SecondaryHeader title="Profile" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
          <Text style={styles.errorDetail}>{error.message}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SecondaryHeader title="Profile" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Profile Completion Banner */}
          {profile && !profile.profile_complete && (
            <View style={styles.completionBanner}>
              <Svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2}
              >
                <Circle cx={12} cy={12} r={10} />
                <Path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
              </Svg>
              <Text style={styles.completionText}>
                Complete your profile to get started
              </Text>
            </View>
          )}

          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <AvatarPicker
              avatarUrl={profile?.avatar_url ?? null}
              name={profile?.name || name || "User"}
              onAvatarSelected={handleAvatarSelected}
              onAvatarRemoved={handleAvatarRemoved}
              isUploading={profileMutations.isUploadingAvatar}
              size={120}
            />
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={handleNameChange}
                onBlur={handleNameBlur}
                placeholder="Your name"
                placeholderTextColor="#9ca3af"
                autoComplete="name"
                maxLength={50}
              />
            </View>

            {/* Username Input */}
            <UsernameInput
              value={username}
              onChangeText={handleUsernameChange}
              onCheckAvailability={handleCheckUsername}
              onBlur={handleUsernameBlur}
              currentUsername={profile?.username}
            />

            {/* Email (read-only) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>{user?.email || "—"}</Text>
              </View>
            </View>
          </View>

          {/* Settings Link */}
          <TouchableOpacity
            style={styles.settingsLink}
            onPress={() => navigate("settings")}
            activeOpacity={0.7}
          >
            <View style={styles.settingsLinkContent}>
              <Svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#374151"
                strokeWidth={2}
              >
                <Circle cx={12} cy={12} r={3} strokeLinecap="round" strokeLinejoin="round" />
                <Path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.settingsLinkText}>App Settings</Text>
            </View>
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth={2}
            >
              <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          {/* Sign Out Button */}
          <TouchableOpacity
            style={[styles.signOutButton, isSigningOut && styles.signOutButtonDisabled]}
            onPress={handleSignOut}
            activeOpacity={0.7}
            disabled={isSigningOut}
          >
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth={2}
            >
              <Path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M16 17l5-5-5-5M21 12H9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.signOutText}>
              {isSigningOut ? "Syncing & Signing Out..." : "Sign Out"}
            </Text>
          </TouchableOpacity>
        </ScrollView>

      </KeyboardAvoidingView>

      {/* Auto-save Snackbar - positioned over TopBar */}
      {snackbarMessage && (
        <Animated.View
          style={[
            styles.snackbar,
            { opacity: snackbarOpacity, transform: [{ translateY: snackbarTranslateY }] },
          ]}
        >
          <Text style={styles.snackbarText}>{snackbarMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ef4444",
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  completionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 10,
  },
  completionText: {
    flex: 1,
    fontSize: 14,
    color: "#1e40af",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  formSection: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  textInput: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  readOnlyInput: {
    backgroundColor: "#f3f4f6",
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  readOnlyText: {
    fontSize: 16,
    color: "#6b7280",
  },
  settingsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  settingsLinkContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsLinkText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
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
    marginTop: 8,
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
  snackbar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 62 : (StatusBar.currentHeight || 24) + 18,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    maxWidth: "70%",
    zIndex: 1000,
  },
  snackbarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
