/**
 * Shared styles for LocationPicker and its sub-components
 */

import { StyleSheet } from 'react-native';
import { theme } from '../../../shared/theme/theme';

export const locationPickerStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text.primary,
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
    backgroundColor: '#fff',
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
    fontWeight: '600',
    color: theme.colors.text.tertiary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Search Input
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
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
    color: theme.colors.text.primary,
  },
  searchClearButton: {
    padding: 6,
  },

  // Tabs - Segment Control Style
  listTabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
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
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.tertiary,
  },
  listTabTextActive: {
    color: theme.colors.text.primary,
    fontWeight: '600',
  },

  // POI Items - Cleaner Layout
  poiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  poiItemSelected: {
    backgroundColor: '#fff',
    borderColor: '#1f2937',
    borderWidth: 1.5,
  },
  savedLocationItem: {
    // No special background - just uses default white
    // Yellow star icon provides visual distinction
  },
  mapLocationItem: {
    backgroundColor: '#f0f9ff',
    borderColor: '#93c5fd',
    marginBottom: 16,
  },

  // Left column: Icon only
  poiIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  poiIconContainerSelected: {
    backgroundColor: '#fee2e2',
  },
  poiIconContainerSaved: {
    backgroundColor: '#fef3c7',
  },

  // Middle column: Info
  poiInfo: {
    flex: 1,
    marginRight: 8,
  },
  poiName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  poiCategory: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 1,
  },
  poiAddress: {
    fontSize: 12,
    color: '#9ca3af',
  },

  // Right column: Distance + Action
  poiRightColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  poiDistance: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
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
    fontWeight: '500',
    color: '#6b7280',
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
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },

  // Callout styles for map markers
  calloutContainer: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: 200,
  },
  calloutContainerRed: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: 200,
  },
  calloutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
    fontWeight: '600',
    color: theme.colors.text.tertiary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formInput: {
    fontSize: 16,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  formValue: {
    fontSize: 15,
    color: theme.colors.text.primary,
    lineHeight: 22,
  },
  formValueLarge: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.text.primary,
    lineHeight: 24,
  },
  formDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
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
    backgroundColor: theme.colors.background.secondary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text.primary,
    marginLeft: 8,
  },
  actionButtonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  actionButtonDangerText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#dc2626',
    marginLeft: 8,
  },

  // Primary button (full width, bottom) - consistent with GPS picker
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },

  // OK button (legacy - now using primaryButton)
  okButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  okButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Select button - smaller, on list items
  selectButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Use/Customize button for Currently Selected row
  useButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  useButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Legacy link style (removed underline)
  selectLink: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
  },

  // Empty states
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyDetailsState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyDetailsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  emptyDetailsSubtext: {
    fontSize: 14,
    color: '#9ca3af',
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
    color: '#6b7280',
  },
});

export default locationPickerStyles;
