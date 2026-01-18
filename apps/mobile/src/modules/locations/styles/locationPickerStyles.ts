/**
 * Shared styles for LocationPicker and its sub-components
 * Uses themeBase for layout-only values. Colors applied inline via dynamicTheme.
 */

import { StyleSheet } from 'react-native';
import { themeBase } from '../../../shared/theme/themeBase';

export const locationPickerStyles = StyleSheet.create({
  // Modal container (wraps backdrop + sheet)
  modalContainer: {
    flex: 1,
  },
  // Semi-transparent backdrop
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  // Sheet container with rounded top corners (matches BottomSheet)
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '95%',
    borderTopLeftRadius: themeBase.borderRadius.xl,
    borderTopRightRadius: themeBase.borderRadius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    overflow: 'hidden',
  },
  // Container styles
  container: {
    flex: 1,
  },
  // Grabber bar for swipe-to-close gesture
  grabberContainer: {
    alignItems: 'center',
    paddingVertical: themeBase.spacing.sm,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  // Header matching PickerBottomSheet style (left-aligned title, X on right)
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: themeBase.spacing.lg,
    paddingBottom: themeBase.spacing.md,
  },
  pickerHeaderTitle: {
    fontSize: 18,
  },
  pickerCloseButton: {
    padding: 4,
  },
  // Legacy header (keep for compatibility with sub-components)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 8,
  },
  content: {
    flex: 1,
  },

  // Map styles
  mapContainer: {
    position: 'relative',
    height: 280,
  },
  map: {
    flex: 1,
  },
  mapLocationButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  mapFitButton: {
    position: 'absolute',
    right: 12,
    bottom: 60, // Above the location button
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  // List Container
  listContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  poiList: {
    flex: 1,
    height: 0,
  },
  poiListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  listTitle: {
    fontSize: 13,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Search Row (search input + saved only toggle)
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  // Search Input
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchClearButton: {
    padding: 6,
  },
  // Saved Only Toggle
  savedOnlyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  savedOnlyText: {
    fontSize: 14,
  },

  // Tabs - Segment Control Style (legacy, kept for compatibility)
  listTabs: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
  },
  listTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  listTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listTabText: {
    fontSize: 14,
  },
  listTabTextActive: {
    // color applied inline
  },

  // POI Items - Cleaner Layout
  poiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  // Compact mode styles (keyboard visible)
  poiItemCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 4,
    borderRadius: 8,
  },
  poiIconContainerCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  poiInfoCompact: {
    marginRight: 4,
  },
  poiNameCompact: {
    fontSize: 14,
    marginBottom: 0,
  },
  poiAddressCompact: {
    fontSize: 11,
    marginTop: 1,
  },
  poiDistanceCompact: {
    fontSize: 11,
  },
  poiListContentCompact: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  poiItemSelected: {
    borderWidth: 1.5,
  },
  savedLocationItem: {
    // No special background - just uses default white
    // Yellow star icon provides visual distinction
  },
  mapLocationItem: {
    marginBottom: 16,
  },

  // Left column: Icon only
  poiIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  poiIconContainerSelected: {
    // background color applied inline
  },
  poiIconContainerSaved: {
    // background color applied inline
  },

  // Middle column: Info
  poiInfo: {
    flex: 1,
    marginRight: 8,
  },
  poiName: {
    fontSize: 15,
    marginBottom: 2,
  },
  poiCategory: {
    fontSize: 13,
    marginBottom: 1,
  },
  poiAddress: {
    fontSize: 12,
  },

  // Right column: Distance + Action
  poiRightColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  poiDistance: {
    fontSize: 12,
  },

  // Legacy styles for compatibility
  poiLeftColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    width: 44,
  },
  poiDistanceSmall: {
    fontSize: 11,
    marginTop: 4,
  },
  poiCategoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  poiRightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  selectedPOI: {
    // colors applied inline
  },

  // Callout styles for map markers
  calloutContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: 200,
  },
  calloutContainerRed: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: 200,
  },
  calloutText: {
    fontSize: 13,
    textAlign: 'center',
  },

  // Form styles (Create/Edit Location)
  createLocationContainer: {
    flex: 1,
  },
  createLocationScroll: {
    flex: 1,
  },
  createLocationContent: {
    padding: 20,
    paddingBottom: 40,
  },
  // Entry count badge (shows how many entries use this location)
  entryCountBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  entryCountText: {
    fontSize: 13,
  },

  formSection: {
    marginBottom: 24,
  },
  formSectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  formSectionRowContent: {
    flex: 1,
  },
  formLabel: {
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formInput: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  formValue: {
    fontSize: 15,
    lineHeight: 22,
  },
  formValueLarge: {
    fontSize: 18,
    lineHeight: 24,
  },
  formDivider: {
    height: 1,
    marginBottom: 24,
  },
  formActions: {
    gap: 12,
  },

  // Action buttons - consistent with GPS picker style
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 16,
    marginLeft: 8,
  },
  actionButtonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionButtonDangerText: {
    fontSize: 16,
    marginLeft: 8,
  },

  // Primary button (full width, bottom) - consistent with GPS picker
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
  },

  // OK button (legacy - now using primaryButton)
  okButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  okButtonText: {
    fontSize: 16,
  },

  // Select button - smaller, on list items
  selectButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 13,
  },

  // Use/Customize button for Currently Selected row
  useButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  useButtonText: {
    fontSize: 13,
  },

  // Legacy link style (removed underline)
  selectLink: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectLinkText: {
    fontSize: 13,
  },

  // Empty states
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyDetailsState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyDetailsText: {
    fontSize: 16,
    marginBottom: 8,
  },
  emptyDetailsSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },

  // Utility
  loader: {
    marginVertical: 20,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },

  // ============================================================================
  // NEW CARD-BASED STYLES (for CurrentLocationView and CreateLocationView)
  // ============================================================================

  // View container with padding
  viewContainer: {
    flex: 1,
  },
  viewScroll: {
    flex: 1,
  },
  viewContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Hero Card - Location name display (CurrentLocationView)
  heroCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  heroIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroName: {
    fontSize: 20,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroBadgeText: {
    fontSize: 12,
  },

  // Info Card - Address/coordinates display
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoCardLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  infoCardText: {
    fontSize: 15,
    lineHeight: 22,
  },
  infoCardCoords: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 6,
  },
  infoCardCoordsText: {
    fontSize: 13,
  },

  // Input Card - Name input (CreateLocationView)
  inputCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  inputCardLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputCardInput: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  // Action Card - Settings-style action rows
  actionCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  actionRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionRowText: {
    fontSize: 16,
  },

  // Change Location button (link style, for going back to select)
  changeLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    marginBottom: 16,
  },
  changeLocationText: {
    fontSize: 15,
  },

  // Primary Save Button (full width)
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
  },

  // Edit mode inline input (CurrentLocationView)
  editModeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  editModeInput: {
    fontSize: 18,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  editModeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editModeButtonPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editModeButtonSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editModeButtonText: {
    fontSize: 15,
  },

  // ============================================================================
  // HORIZONTAL LOCATION CARD (CurrentLocationView - modern layout)
  // ============================================================================

  // Main card with horizontal layout: icon left, content right
  locationCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  // Large pin icon on left
  locationCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  // Content area on right
  locationCardContent: {
    flex: 1,
    paddingTop: 2,
  },
  // Primary text: Name or coordinates (large)
  locationCardName: {
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 2,
  },
  // Context: Neighborhood · City, State
  locationCardContext: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 2,
  },
  // Street address and postal/country
  locationCardAddress: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Coordinates row with icon
  locationCardCoordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  locationCardCoords: {
    fontSize: 12,
  },
  // Entry count badge
  locationCardBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 10,
  },
  locationCardBadgeText: {
    fontSize: 12,
  },
});

export default locationPickerStyles;
