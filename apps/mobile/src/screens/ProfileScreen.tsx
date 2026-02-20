/**
 * Profile Screen
 *
 * Focused profile editor with explicit Save:
 * - Avatar upload/change (saves immediately — binary upload)
 * - Name and username editing with explicit Save button
 * - "Unsaved changes" prompt on back navigation
 * - Profile completion tracking
 *
 * Settings and Sign Out live on AccountScreen — not here.
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Icon, Button } from "../shared/components";
import { useAuth } from "../shared/contexts/AuthContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { BottomBar } from "../components/layout/BottomBar";
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
import { useNavigate, useBeforeBack } from "../shared/navigation";
import { useKeyboardHeight } from "../modules/entries/components/hooks/useKeyboardHeight";
import { themeBase } from "../shared/theme/themeBase";

const log = createScopedLogger("ProfileScreen");

export function ProfileScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const keyboardHeight = useKeyboardHeight();

  // Profile data with offline support
  const { profile, isLoading, error, profileMutations, isOffline } = useMobileProfile(user?.id);

  // Local form state
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setUsername(profile.username);
    }
  }, [profile]);

  // Track unsaved changes
  const hasChanges = profile
    ? name.trim() !== profile.name || username.trim() !== profile.username
    : false;

  // Block hardware/swipe back when unsaved changes exist
  useBeforeBack(
    hasChanges
      ? async () => {
          Alert.alert(
            "Unsaved Changes",
            "You have unsaved changes. Discard them?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Discard",
                style: "destructive",
                onPress: () => navigate("back"),
              },
            ]
          );
          return true; // Block default navigation
        }
      : null
  );

  // Handle back with unsaved changes prompt
  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Discard them?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigate("back"),
          },
        ]
      );
    } else {
      navigate("back");
    }
  }, [hasChanges, navigate]);

  // Handle name change
  const handleNameChange = useCallback((text: string) => {
    setName(text);
  }, []);

  // Handle username change
  const handleUsernameChange = useCallback((text: string) => {
    setUsername(text);
  }, []);

  // Explicit save — validates and saves name + username
  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();

    // Validate name — required
    if (!trimmedName) {
      Alert.alert("Name Required", "Please enter a display name.");
      return;
    }
    const nameValidation = validateName(trimmedName);
    if (!nameValidation.isValid) {
      Alert.alert("Invalid Name", nameValidation.error);
      return;
    }

    // Validate username format
    if (trimmedUsername && trimmedUsername !== profile?.username) {
      const usernameValidation = validateUsername(trimmedUsername);
      if (!usernameValidation.isValid) {
        Alert.alert("Invalid Username", usernameValidation.error);
        return;
      }

      // Check availability
      try {
        const isAvailable = await profileMutations.checkUsername(trimmedUsername);
        if (!isAvailable) {
          Alert.alert("Username Taken", "This username is already in use.");
          return;
        }
      } catch (err) {
        log.error("Username check failed", err);
        Alert.alert("Error", "Could not verify username availability.");
        return;
      }
    }

    // Save
    try {
      const updates: Record<string, any> = { profile_complete: true };
      if (trimmedName && trimmedName !== profile?.name) {
        updates.name = trimmedName;
      }
      if (trimmedUsername && trimmedUsername !== profile?.username) {
        updates.username = trimmedUsername;
      }

      log.info("Saving profile", updates);
      await profileMutations.updateProfile(updates);
      log.success("Profile saved");
    } catch (err: any) {
      log.error("Profile save failed", err);
      Alert.alert("Save Failed", err.message || "Failed to save profile.");
    }
  }, [name, username, profile, profileMutations]);

  // Check username availability (for UsernameInput indicator)
  const handleCheckUsername = useCallback(
    async (usernameToCheck: string): Promise<boolean> => {
      try {
        return await profileMutations.checkUsername(usernameToCheck);
      } catch (err) {
        log.error("Username check failed", err);
        return false;
      }
    },
    [profileMutations]
  );

  // Handle avatar selection (saves immediately — binary upload, not form data)
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
      } catch (err: any) {
        log.error("Avatar upload failed", err);
        Alert.alert("Upload Failed", err.message || "Failed to upload avatar.");
      }
    },
    [profileMutations]
  );

  // Handle avatar removal
  const handleAvatarRemoved = useCallback(async () => {
    try {
      log.info("Removing avatar");
      await profileMutations.deleteAvatar();
      log.success("Avatar removed");
    } catch (err: any) {
      log.error("Avatar removal failed", err);
      Alert.alert("Remove Failed", err.message || "Failed to remove avatar.");
    }
  }, [profileMutations]);

  // Loading state
  if (isLoading && !profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Profile" />
        <View style={styles.centerContainer}>
          <Text style={[styles.centerText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Offline with no cached profile
  if (isOffline && !profile && !isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Profile" />
        <View style={styles.centerContainer}>
          <Icon name="WifiOff" size={48} color={theme.colors.text.tertiary} />
          <Text style={[styles.centerTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>You're Offline</Text>
          <Text style={[styles.centerSubtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
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
        <View style={styles.centerContainer}>
          <Text style={[styles.centerTitle, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.semibold }]}>Failed to load profile</Text>
          <Text style={[styles.centerSubtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>{error.message}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Profile" onBack={handleBack} />

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

          {/* Bottom spacer — room for BottomBar save button when visible */}
          <View style={{ height: hasChanges ? 120 : themeBase.spacing.xl }} />
        </ScrollView>

      </KeyboardAvoidingView>

      {/* Save Button */}
      {hasChanges && (
        <BottomBar keyboardOffset={keyboardHeight}>
          <Button
            label="Save Changes"
            onPress={handleSave}
            size="lg"
            fullWidth
          />
        </BottomBar>
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
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  centerText: {
    fontSize: 16,
  },
  centerTitle: {
    fontSize: 18,
    marginTop: themeBase.spacing.lg,
    marginBottom: themeBase.spacing.sm,
  },
  centerSubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f59e0b",
    padding: 10,
    borderRadius: themeBase.borderRadius.sm,
    marginBottom: themeBase.spacing.md,
    gap: themeBase.spacing.sm,
  },
  offlineBannerText: {
    color: "#ffffff",
    fontSize: 13,
  },
  completionBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.sm,
    marginBottom: 20,
    gap: themeBase.spacing.md,
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
    borderRadius: themeBase.borderRadius.md,
    padding: themeBase.spacing.lg,
    marginBottom: themeBase.spacing.lg,
  },
  inputGroup: {
    marginBottom: themeBase.spacing.md,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
  },
  textInput: {
    borderRadius: themeBase.borderRadius.sm,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  readOnlyInput: {
    borderRadius: themeBase.borderRadius.sm,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  readOnlyText: {
    fontSize: 16,
  },
});
