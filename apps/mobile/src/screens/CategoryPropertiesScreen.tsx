import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator, Animated, Platform } from "react-native";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { useCategories } from "../modules/categories/mobileCategoryHooks";
import { TopBar } from "../components/layout/TopBar";
import { useState, useEffect, useRef } from "react";
import type { Category } from "@trace/core";
import { theme } from "../shared/theme/theme";

interface CategoryPropertiesScreenProps {
  categoryId?: string;
}

export function CategoryPropertiesScreen({ categoryId }: CategoryPropertiesScreenProps = {}) {
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const { categories, isLoading, categoryMutations } = useCategories();

  const category = categories.find(c => c.category_id === categoryId);

  // Form state
  const [entryTitleTemplate, setEntryTitleTemplate] = useState(category?.entry_title_template || "");
  const [entryContentTemplate, setEntryContentTemplate] = useState(category?.entry_content_template || "");
  const [useRating, setUseRating] = useState(category?.entry_use_rating || false);
  const [usePriority, setUsePriority] = useState(category?.entry_use_priority || false);
  const [useStatus, setUseStatus] = useState(category?.entry_use_status !== false); // default true
  const [useDueDates, setUseDueDates] = useState(category?.entry_use_duedates || false);
  const [useLocation, setUseLocation] = useState(category?.entry_use_location !== false); // default true
  const [usePhotos, setUsePhotos] = useState(category?.entry_use_photos !== false); // default true
  const [contentType, setContentType] = useState(category?.entry_content_type || "richformat");
  const [isPrivate, setIsPrivate] = useState(category?.is_private || false);
  const [isLocalOnly, setIsLocalOnly] = useState(category?.is_localonly || false);

  const [isSaving, setIsSaving] = useState(false);

  // Snackbar state
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const snackbarOpacity = useRef(new Animated.Value(0)).current;

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    Animated.sequence([
      Animated.timing(snackbarOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(snackbarOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setSnackbarMessage(null));
  };

  // Update form when category changes
  useEffect(() => {
    if (category) {
      setEntryTitleTemplate(category.entry_title_template || "");
      setEntryContentTemplate(category.entry_content_template || "");
      setUseRating(category.entry_use_rating || false);
      setUsePriority(category.entry_use_priority || false);
      setUseStatus(category.entry_use_status !== false);
      setUseDueDates(category.entry_use_duedates || false);
      setUseLocation(category.entry_use_location !== false);
      setUsePhotos(category.entry_use_photos !== false);
      setContentType(category.entry_content_type || "richformat");
      setIsPrivate(category.is_private || false);
      setIsLocalOnly(category.is_localonly || false);
    }
  }, [category]);

  const handleSave = async () => {
    if (!categoryId) return;

    try {
      setIsSaving(true);
      await categoryMutations.updateCategory(categoryId, {
        entry_title_template: entryTitleTemplate || null,
        entry_content_template: entryContentTemplate || null,
        entry_use_rating: useRating,
        entry_use_priority: usePriority,
        entry_use_status: useStatus,
        entry_use_duedates: useDueDates,
        entry_use_location: useLocation,
        entry_use_photos: usePhotos,
        entry_content_type: contentType,
        is_private: isPrivate,
        is_localonly: isLocalOnly,
      });
      showSnackbar("Category properties updated successfully!");
      // Navigate back after a short delay to let user see the message
      setTimeout(() => navigate("categories"), 1000);
    } catch (error) {
      console.error("Failed to update category properties:", error);
      showSnackbar("Failed to update category properties");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("categories");
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <TopBar
          title="Category Properties"
          menuItems={menuItems}
          userEmail={userEmail}
          onProfilePress={onProfilePress}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.text.tertiary} />
          <Text style={styles.loadingText}>Loading category...</Text>
        </View>
      </View>
    );
  }

  if (!category) {
    return (
      <View style={styles.container}>
        <TopBar
          title="Category Properties"
          menuItems={menuItems}
          userEmail={userEmail}
          onProfilePress={onProfilePress}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Category not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar
        title="Category Properties"
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

      <ScrollView style={styles.content}>
        {/* Category Info */}
        <View style={styles.infoCard}>
          <Text style={styles.categoryName}>{category.name}</Text>
          <Text style={styles.categoryPath}>{category.full_path}</Text>
        </View>

        {/* Templates Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entry Templates</Text>
          <Text style={styles.sectionDescription}>
            Auto-populate new entries with these templates. Use variables: {"{date}"}, {"{day}"}, {"{month}"}
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Title Template</Text>
            <TextInput
              value={entryTitleTemplate}
              onChangeText={setEntryTitleTemplate}
              placeholder="e.g., Journal - {date}"
              placeholderTextColor="#9ca3af"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Content Template</Text>
            <TextInput
              value={entryContentTemplate}
              onChangeText={setEntryContentTemplate}
              placeholder="e.g., Today is {day}, {date}"
              placeholderTextColor="#9ca3af"
              style={[styles.input, styles.textArea]}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Feature Toggles Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entry Features</Text>
          <Text style={styles.sectionDescription}>
            Enable or disable features for entries in this category
          </Text>

          <View style={styles.switchField}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Rating</Text>
              <Text style={styles.switchDescription}>Allow rating entries (0-5 stars)</Text>
            </View>
            <Switch
              value={useRating}
              onValueChange={setUseRating}
              trackColor={{ false: "#d1d5db", true: "#60a5fa" }}
              thumbColor={useRating ? "#3b82f6" : "#f3f4f6"}
            />
          </View>

          <View style={styles.switchField}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Priority</Text>
              <Text style={styles.switchDescription}>Allow setting entry priority</Text>
            </View>
            <Switch
              value={usePriority}
              onValueChange={setUsePriority}
              trackColor={{ false: "#d1d5db", true: "#60a5fa" }}
              thumbColor={usePriority ? "#3b82f6" : "#f3f4f6"}
            />
          </View>

          <View style={styles.switchField}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Status</Text>
              <Text style={styles.switchDescription}>Track entry status (incomplete, in progress, complete)</Text>
            </View>
            <Switch
              value={useStatus}
              onValueChange={setUseStatus}
              trackColor={{ false: "#d1d5db", true: "#60a5fa" }}
              thumbColor={useStatus ? "#3b82f6" : "#f3f4f6"}
            />
          </View>

          <View style={styles.switchField}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Due Dates</Text>
              <Text style={styles.switchDescription}>Allow setting due dates for entries</Text>
            </View>
            <Switch
              value={useDueDates}
              onValueChange={setUseDueDates}
              trackColor={{ false: "#d1d5db", true: "#60a5fa" }}
              thumbColor={useDueDates ? "#3b82f6" : "#f3f4f6"}
            />
          </View>

          <View style={styles.switchField}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Location</Text>
              <Text style={styles.switchDescription}>Enable location tracking for entries</Text>
            </View>
            <Switch
              value={useLocation}
              onValueChange={setUseLocation}
              trackColor={{ false: "#d1d5db", true: "#60a5fa" }}
              thumbColor={useLocation ? "#3b82f6" : "#f3f4f6"}
            />
          </View>

          <View style={styles.switchField}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Photos</Text>
              <Text style={styles.switchDescription}>Allow attaching photos to entries</Text>
            </View>
            <Switch
              value={usePhotos}
              onValueChange={setUsePhotos}
              trackColor={{ false: "#d1d5db", true: "#60a5fa" }}
              thumbColor={usePhotos ? "#3b82f6" : "#f3f4f6"}
            />
          </View>
        </View>

        {/* Privacy & Sync Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Sync</Text>
          <Text style={styles.sectionDescription}>
            Control visibility and synchronization behavior
          </Text>

          <View style={styles.switchField}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Private Category</Text>
              <Text style={styles.switchDescription}>
                Entries only visible when viewing this category directly (hidden from "All" and parent categories)
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: "#d1d5db", true: "#60a5fa" }}
              thumbColor={isPrivate ? "#3b82f6" : "#f3f4f6"}
            />
          </View>

          <View style={styles.switchField}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Local Only</Text>
              <Text style={styles.switchDescription}>
                Category and its entries will not sync to cloud (device only)
              </Text>
            </View>
            <Switch
              value={isLocalOnly}
              onValueChange={setIsLocalOnly}
              trackColor={{ false: "#d1d5db", true: "#60a5fa" }}
              thumbColor={isLocalOnly ? "#3b82f6" : "#f3f4f6"}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isSaving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Snackbar Notification */}
      {snackbarMessage && (
        <Animated.View style={[styles.snackbar, { opacity: snackbarOpacity }]}>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#6b7280",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    textAlign: "center",
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  categoryName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  categoryPath: {
    fontSize: 14,
    color: "#6b7280",
  },
  section: {
    backgroundColor: "#ffffff",
    padding: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 16,
    lineHeight: 18,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  switchField: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 16,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  bottomSpacer: {
    height: 24,
  },
  snackbar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  snackbarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
