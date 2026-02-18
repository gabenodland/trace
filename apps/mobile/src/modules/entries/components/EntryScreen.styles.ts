import { StyleSheet, Platform, StatusBar } from "react-native";
import { themeBase } from "../../../shared/theme/themeBase";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  titleBar: {
    height: 90,
    paddingTop: Platform.OS === "ios" ? 45 : (StatusBar.currentHeight || 0) + 10,
    paddingHorizontal: themeBase.spacing.sm,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  titleBarFullScreen: {
    // Keep same structure as titleBar but adjust spacing
    // Normal titleBar: height 90, paddingTop 45 (ios), paddingBottom 4
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  headerTitleInput: {
    fontSize: 17,
    fontWeight: "600",
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
    fontWeight: "500",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  headerSaveButton: {
    width: 24,
    minHeight: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSaveButtonDisabled: {
    opacity: 0.5,
  },
  headerSaveText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  headerSaveTextDisabled: {
    opacity: 0.5,
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
    paddingHorizontal: themeBase.spacing.lg,
    paddingVertical: 6,
  },
  titleInputFullWidth: {
    fontSize: 22,
    padding: 0,
    margin: 0,
    textAlign: "center",
  },
  titleTouchable: {
    width: "100%",
  },
  titleText: {
    fontSize: 22,
    textAlign: "center",
  },
  titleBarContent: {
    flex: 1,
  },
  menuButton: {
    padding: themeBase.spacing.sm,
  },
  metadataBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: themeBase.spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // Subtle iOS-style shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  metadataContent: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: 6,
    columnGap: 0, // Pills handle their own spacing via dividers
  },
  metadataMenuSection: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: themeBase.spacing.sm,
  },
  metadataSeparator: {
    width: 1,
    height: 24,
    opacity: 0.2,
    marginLeft: themeBase.spacing.sm,
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
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  metadataTextActive: {
    fontWeight: "600",
  },
  metadataTextUnsupported: {
    textDecorationLine: "line-through",
  },
  metadataDivider: {
    fontSize: 10,
    paddingHorizontal: 8,
  },
  entryMenuButton: {
    padding: 8,
    borderRadius: 6,
  },
  entryMenuButtonLabel: {
    fontSize: 11,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  attributePickerContainer: {
    borderRadius: themeBase.borderRadius.lg,
    padding: themeBase.spacing.md,
    gap: themeBase.spacing.xs,
  },
  attributePickerTitle: {
    fontSize: 16,
    fontWeight: themeBase.typography.fontWeight.semibold,
    marginBottom: themeBase.spacing.sm,
  },
  attributePickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.md,
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.sm,
    borderRadius: themeBase.borderRadius.md,
  },
  attributePickerItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  attributePickerItemText: {
    fontSize: 16,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  menuDivider: {
    height: 1,
    marginVertical: themeBase.spacing.sm,
  },
  topBarButtonTask: {
    // No background color
  },
  topBarButtonTaskText: {
  },
  topBarButtonComplete: {
    // No background color
  },
  topBarButtonCompleteText: {
  },
  topBarButtonDue: {
    // No background color
  },
  topBarButtonDueText: {
  },
  contentContainer: {
    flex: 1,
    // No background - inherits from parent container (white)
  },
  titleContainer: {
    flex: 1,
  },
  titleCollapsed: {
    width: "100%",
    paddingVertical: 4,
  },
  titlePlaceholder: {
    fontSize: 22,
    textAlign: "center",
  },
  titleInput: {
    fontSize: 22,
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
  },
  entryDateText: {
    fontSize: 19,
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
  },
  deleteButton: {
    padding: themeBase.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: themeBase.spacing.sm,
  },
  cancelButton: {
    padding: themeBase.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: themeBase.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  saveButton: {
    padding: themeBase.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: themeBase.spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.3,
  },
  editButton: {
    padding: themeBase.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: themeBase.spacing.sm,
  },
  datePickerContainer: {
    borderRadius: themeBase.borderRadius.lg,
    padding: themeBase.spacing.lg,
    gap: themeBase.spacing.md,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: themeBase.typography.fontWeight.semibold,
    marginBottom: themeBase.spacing.sm,
  },
  datePickerButton: {
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
    borderRadius: themeBase.borderRadius.md,
    alignItems: "center",
  },
  datePickerButtonText: {
    fontSize: 16,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  datePickerButtonDanger: {
  },
  datePickerButtonDangerText: {
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
    borderRadius: themeBase.borderRadius.lg,
    padding: themeBase.spacing.lg,
    gap: themeBase.spacing.md,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: themeBase.typography.fontWeight.semibold,
    marginBottom: themeBase.spacing.sm,
  },
  starRatingRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: themeBase.spacing.xs,
    paddingVertical: themeBase.spacing.lg,
  },
  starRatingButton: {
    padding: themeBase.spacing.sm,
  },
  starRatingIcon: {
    fontSize: 40,
  },
  starRatingIconActive: {
  },
  priorityDisplay: {
    alignItems: "center",
    paddingVertical: themeBase.spacing.xl,
  },
  priorityValueText: {
    fontSize: 48,
    fontWeight: themeBase.typography.fontWeight.bold,
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: themeBase.typography.fontWeight.medium,
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
    borderRadius: 2,
  },
  sliderSegmentActive: {
  },
  quickButtonRow: {
    flexDirection: "row",
    gap: themeBase.spacing.sm,
    justifyContent: "space-between",
  },
  quickButton: {
    flex: 1,
    paddingVertical: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    alignItems: "center",
  },
  quickButtonSelected: {
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
  quickButtonTextSelected: {
  },
  pickerButton: {
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
    borderRadius: themeBase.borderRadius.md,
    alignItems: "center",
  },
  pickerButtonDanger: {
  },
  pickerButtonDangerText: {
  },
  pickerActionRow: {
    flexDirection: "row",
    gap: themeBase.spacing.sm,
  },
  pickerActionButton: {
    flex: 1,
    paddingVertical: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    alignItems: "center",
  },
  pickerButtonPrimary: {
  },
  pickerButtonSecondary: {
    borderWidth: 1,
  },
  pickerButtonText: {
    fontSize: 16,
    fontWeight: themeBase.typography.fontWeight.medium,
  },
});
