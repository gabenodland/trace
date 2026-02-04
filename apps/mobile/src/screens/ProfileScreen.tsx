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
import { Icon } from "../shared/components";
import { useAuth } from "../shared/contexts/AuthContext";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { useSync } from "../shared/sync";
import { createScopedLogger } from "../shared/utils/logger";
import {
  validateName,
  validateUsername,
  type AvatarImageInput,
} from "@trace/core";
import { useMobileProfile } from "../shared/hooks/useMobileProfile";
import { AvatarPicker, UsernameInput } from "../modules/profile/components";
import type { AvatarImageData } from "../modules/profile/components/AvatarPicker";
import { useTheme } from "../shared/contexts/ThemeContext";

const log = createScopedLogger("ProfileScreen");

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { navigate } = useNavigation();
  const { sync } = useSync();
  const theme = useTheme();

  // Profile data with offline support - pass user.id to ensure mutations work even before profile loads
  const { profile, isLoading, error, profileMutations, isOffline } = useMobileProfile(user?.id);

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
    // Warn when offline
    if (isOffline) {
      Alert.alert(
        "You're Offline",
        "Your changes won't be synced until you're online. Sign out anyway?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign Out",
            style: "destructive",
            onPress: async () => {
              setIsSigningOut(true);
              try {
                await signOut();
              } finally {
                setIsSigningOut(false);
              }
            },
          },
        ]
      );
      return;
    }

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
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Profile" />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Offline with no cached profile
  if (isOffline && !profile && !isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Profile" />
        <View style={styles.errorContainer}>
          <Icon name="WifiOff" size={48} color={theme.colors.text.tertiary} />
          <Text style={[styles.errorText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold, marginTop: 16 }]}>You're Offline</Text>
          <Text style={[styles.errorDetail, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
            Connect to the internet to view your profile
          </Text>
        </View>
      </View>
    );
  }

  // Error state (online error)
  if (error && !profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Profile" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.semibold }]}>Failed to load profile</Text>
          <Text style={[styles.errorDetail, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{error.message}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Profile" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Offline Banner */}
          {isOffline && profile && (
            <View style={styles.offlineBanner}>
              <Icon name="WifiOff" size={16} color="#ffffff" />
              <Text style={[styles.offlineBannerText, { fontFamily: theme.typography.fontFamily.medium }]}>
                Offline - Viewing cached profile
              </Text>
            </View>
          )}

          {/* Profile Completion Banner */}
          {profile && !profile.profile_complete && !isOffline && (
            <View style={[styles.completionBanner, { backgroundColor: theme.colors.functional.accentLight }]}>
              <Icon name="Info" size={20} color={theme.colors.functional.accent} />
              <Text style={[styles.completionText, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.medium }]}>
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
              disabled={isOffline}
            />
          </View>

          {/* Form Section */}
          <View style={[styles.formSection, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Display Name</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isOffline ? theme.colors.background.tertiary : theme.colors.background.secondary,
                    borderColor: theme.colors.border.light,
                    color: isOffline ? theme.colors.text.secondary : theme.colors.text.primary,
                    fontFamily: theme.typography.fontFamily.regular,
                  },
                ]}
                value={name}
                onChangeText={handleNameChange}
                onBlur={handleNameBlur}
                placeholder="Your name"
                placeholderTextColor={theme.colors.text.tertiary}
                autoComplete="name"
                maxLength={50}
                editable={!isOffline}
              />
            </View>

            {/* Username Input */}
            <UsernameInput
              value={username}
              onChangeText={handleUsernameChange}
              onCheckAvailability={handleCheckUsername}
              onBlur={handleUsernameBlur}
              currentUsername={profile?.username}
              disabled={isOffline}
            />

            {/* Email (read-only) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Email</Text>
              <View style={[styles.readOnlyInput, { backgroundColor: theme.colors.background.tertiary, borderColor: theme.colors.border.light }]}>
                <Text style={[styles.readOnlyText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{user?.email || "—"}</Text>
              </View>
            </View>
          </View>

          {/* Settings Link */}
          <TouchableOpacity
            style={[styles.settingsLink, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}
            onPress={() => navigate("settings")}
            activeOpacity={0.7}
          >
            <View style={styles.settingsLinkContent}>
              <Icon name="Settings" size={20} color={theme.colors.text.primary} />
              <Text style={[styles.settingsLinkText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>App Settings</Text>
            </View>
            <Icon name="ChevronRight" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>

          {/* Sign Out Button */}
          <TouchableOpacity
            style={[styles.signOutButton, isSigningOut && styles.signOutButtonDisabled]}
            onPress={handleSignOut}
            activeOpacity={0.7}
            disabled={isSigningOut}
          >
            <Icon name="LogOut" size={20} color="#ffffff" />
            <Text style={[styles.signOutText, { fontFamily: theme.typography.fontFamily.semibold }]}>
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
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    // Note: fontWeight removed - use fontFamily with weight variant instead
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    textAlign: "center",
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f59e0b",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  offlineBannerText: {
    color: "#ffffff",
    fontSize: 13,
  },
  completionBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 10,
  },
  completionText: {
    flex: 1,
    fontSize: 14,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  formSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    // Note: fontWeight removed - use fontFamily with weight variant instead
    marginBottom: 4,
  },
  textInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  readOnlyInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  readOnlyText: {
    fontSize: 16,
  },
  settingsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  settingsLinkContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsLinkText: {
    fontSize: 16,
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
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
    // Note: fontWeight removed - use fontFamily with weight variant instead
    textAlign: "center",
  },
});
