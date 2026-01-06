import { StyleSheet, Platform, StatusBar } from "react-native";
import { theme } from "../../../shared/theme/theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  titleBar: {
    height: 90,
    paddingTop: Platform.OS === "ios" ? 45 : (StatusBar.currentHeight || 0) + 10,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: 4,
    backgroundColor: "#fafafa",
    flexDirection: "row",
    alignItems: "center",
  },
  titleBarFullScreen: {
    // Keep same structure as titleBar but adjust spacing
    // Normal titleBar: height 90, paddingTop 45 (ios), paddingBottom 4
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
  },
  headerTitleInput: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
    flex: 1,
    padding: 0,
    margin: 0,
  },
  headerLeftContainer: {
    width: 70,
    alignItems: "flex-start",
  },
  headerRightContainer: {
    width: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  headerCancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 32,
    justifyContent: "center",
  },
  headerCancelText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#6b7280",
    fontWeight: "500",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  headerSaveButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 32,
    justifyContent: "center",
  },
  headerSaveButtonDisabled: {
    opacity: 0.5,
  },
  headerSaveText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#2563eb",
    fontWeight: "600",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  headerSaveTextDisabled: {
    color: "#9ca3af",
  },
  headerDateContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  headerDateText: {
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "500",
  },
  headerTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerWatchButton: {
    padding: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 6,
    backgroundColor: "#fafafa",
  },
  titleInputFullWidth: {
    flex: 1,
    fontSize: 22,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    padding: 0,
    margin: 0,
    textAlign: "center",
  },
  titleTouchable: {
    flex: 1,
  },
  titleText: {
    fontSize: 22,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: "center",
  },
  titleBarContent: {
    flex: 1,
  },
  menuButton: {
    padding: theme.spacing.sm,
  },
  metadataBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#fafafa",
    rowGap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0, 0, 0, 0.08)",
    // Subtle iOS-style shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  metadataLink: {
    paddingVertical: 6,
    paddingHorizontal: 2,
    maxWidth: 130,
  },
  metadataLinkContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metadataText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  metadataTextActive: {
    color: theme.colors.text.primary,
    fontWeight: "600",
  },
  metadataTextUnsupported: {
    textDecorationLine: "line-through",
    color: "#9ca3af",
  },
  metadataDivider: {
    fontSize: 10,
    color: "#d1d5db",
    paddingHorizontal: 8,
  },
  entryMenuButton: {
    marginLeft: "auto",
    padding: 8,
    opacity: 0.6,
  },
  attributePickerContainer: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  attributePickerTitle: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  attributePickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  attributePickerItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.background.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  attributePickerItemText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: theme.spacing.sm,
  },
  topBarButtonTask: {
    // No background color
  },
  topBarButtonTaskText: {
    color: theme.colors.text.primary,
  },
  topBarButtonComplete: {
    // No background color
  },
  topBarButtonCompleteText: {
    color: theme.colors.text.primary,
  },
  topBarButtonDue: {
    // No background color
  },
  topBarButtonDueText: {
    color: theme.colors.text.primary,
  },
  contentContainer: {
    flex: 1,
    // No background - inherits from parent container (white)
  },
  titleContainer: {
    flex: 1,
  },
  titleCollapsed: {
    flex: 1,
    alignItems: "center",
  },
  titlePlaceholder: {
    fontSize: 22,
    color: theme.colors.text.disabled,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: "center",
  },
  titleInput: {
    fontSize: 22,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    padding: 0,
    margin: 0,
  },
  entryDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 24,
    paddingRight: 16,
    paddingTop: 0,
    paddingBottom: 4,
    backgroundColor: "#fafafa",
  },
  entryDateText: {
    fontSize: 19,
    color: "#6b7280",
    fontWeight: "500",
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  watchIconButton: {
    padding: 4,
  },
  editorContainer: {
    flex: 1,
    paddingLeft: 24,
    paddingRight: 12,
    // paddingBottom is set dynamically based on edit mode and popout state
  },
  // Toolbar styles
  fullScreenToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  toolbarDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#d1d5db",
    marginHorizontal: 4,
  },
  fullScreenEditor: {
    paddingTop: 16,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  toolbarButton: {
    padding: 8,
    borderRadius: 6,
  },
  headingButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  deleteButton: {
    padding: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.sm,
  },
  cancelButton: {
    padding: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  saveButton: {
    padding: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.3,
  },
  editButton: {
    padding: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.sm,
  },
  datePickerContainer: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  datePickerButton: {
    backgroundColor: theme.colors.background.secondary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  datePickerButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  datePickerButtonDanger: {
    backgroundColor: "#fee2e2",
  },
  datePickerButtonDangerText: {
    color: "#dc2626",
  },
  snackbar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : (StatusBar.currentHeight || 24) + 5,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    maxWidth: "70%",
  },
  snackbarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  // Rating and Priority Picker Styles
  pickerContainer: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  starRatingRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.lg,
  },
  starRatingButton: {
    padding: theme.spacing.sm,
  },
  starRatingIcon: {
    fontSize: 40,
    color: "#d1d5db",
  },
  starRatingIconActive: {
    color: "#fbbf24",
  },
  priorityDisplay: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
  },
  priorityValueText: {
    fontSize: 48,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    minWidth: 30,
    textAlign: "center",
  },
  sliderTrack: {
    flex: 1,
    height: 40,
    flexDirection: "row",
    gap: 1,
  },
  sliderSegment: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 2,
  },
  sliderSegmentActive: {
    backgroundColor: "#3b82f6",
  },
  quickButtonRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
  },
  quickButton: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  quickButtonSelected: {
    backgroundColor: "#dbeafe",
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  quickButtonTextSelected: {
    color: "#3b82f6",
  },
  pickerButton: {
    backgroundColor: theme.colors.background.secondary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  pickerButtonDanger: {
    backgroundColor: "#fee2e2",
  },
  pickerButtonDangerText: {
    color: "#dc2626",
  },
  pickerActionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  pickerActionButton: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  pickerButtonPrimary: {
    backgroundColor: "#3b82f6",
  },
  pickerButtonSecondary: {
    backgroundColor: theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
  },
  pickerButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
  },
});
