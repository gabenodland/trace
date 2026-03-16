/**
 * ManagementCard — Shared FlatList card pattern for management screens.
 *
 * Provides the rounded-card visual (top/bottom caps with border radius)
 * for FlatList-based management screens. Handles the Android-specific
 * workarounds for hairline separators and subpixel rendering.
 *
 * Usage:
 *   import { managementCardStyles, CardRowWrapper, useCardListProps } from "../components/layout/ManagementCard";
 *
 *   // In renderItem:
 *   <CardRowWrapper theme={theme}>
 *     <TouchableOpacity ...>content</TouchableOpacity>
 *   </CardRowWrapper>
 *
 *   // On FlatList:
 *   <FlatList {...cardListProps} data={...} renderItem={...} keyExtractor={...} />
 */

import { View, StyleSheet } from "react-native";
import { memo, useMemo, type ReactNode } from "react";
import type { ThemeContextValue } from "../../shared/contexts/ThemeContext";

// ─── Card Row Wrapper ────────────────────────────────────────────────────────

interface CardRowWrapperProps {
  theme: ThemeContextValue;
  children: ReactNode;
}

/** Wraps row content in bg:primary + hairline separator View */
export const CardRowWrapper = memo(function CardRowWrapper({ theme, children }: CardRowWrapperProps) {
  return (
    <View style={{ backgroundColor: theme.colors.background.primary }}>
      {children}
      <View style={[managementCardStyles.rowSeparator, { backgroundColor: theme.colors.border.light }]} />
    </View>
  );
});

// ─── Card List Props Hook ────────────────────────────────────────────────────

interface UseCardListPropsOptions {
  /** Extra content after the bottom cap (e.g. spacer). Default: 30px spacer */
  bottomSpacerHeight?: number;
}

/** Returns standard FlatList props for the management card pattern */
export function useCardListProps(theme: ThemeContextValue, options?: UseCardListPropsOptions) {
  const spacerHeight = options?.bottomSpacerHeight ?? 30;
  const bgPrimary = theme.colors.background.primary;

  const listHeader = useMemo(() => (
    <View style={[managementCardStyles.cardTopCap, { backgroundColor: bgPrimary }]} />
  ), [bgPrimary]);

  const listFooter = useMemo(() => (
    <>
      <View style={[managementCardStyles.cardBottomCap, { backgroundColor: bgPrimary }]} />
      {spacerHeight > 0 && <View style={{ height: spacerHeight }} />}
    </>
  ), [bgPrimary, spacerHeight]);

  return {
    style: managementCardStyles.scrollArea,
    contentContainerStyle: managementCardStyles.scrollContent,
    ListHeaderComponent: listHeader,
    ListFooterComponent: listFooter,
    showsVerticalScrollIndicator: false,
  };
}

// ─── Shared Styles ───────────────────────────────────────────────────────────

export const managementCardStyles = StyleSheet.create({
  /** Outer screen container */
  container: {
    flex: 1,
  },
  /** Inner content area (below header, holds sort bar + list) */
  content: {
    flex: 1,
  },
  /** Fixed sort bar area */
  fixedControls: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    zIndex: 1,
  },
  /** FlatList outer style */
  scrollArea: {
    flex: 1,
  },
  /** FlatList contentContainerStyle — positions the card */
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  /** Top cap — rounds the card top, overlaps first row by 1px */
  cardTopCap: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    height: 12,
    marginBottom: -1,
  },
  /** Bottom cap — rounds the card bottom. Negative marginTop overlaps the last
   *  row's separator View (hairline + 1px marginVertical = ~3px) to hide it. */
  cardBottomCap: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    height: 20,
    marginTop: -8,
  },
  /** Hairline separator inside each row — marginVertical fixes Android subpixel rendering */
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 1,
  },
  /** Standard row layout */
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  /** No results container */
  noResultsContainer: {
    padding: 32,
    alignItems: "center",
  },
  /** No results text */
  noResultsText: {
    fontSize: 15,
    textAlign: "center",
  },
});
