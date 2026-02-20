/**
 * StreamDrawerContent
 *
 * Tabbed drawer for navigating streams, locations, tags, and mentions.
 * Horizontal tab bar at top with swipe-between-tabs on the content area.
 */

import { useState, useCallback, useMemo, useRef, useEffect, memo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, PanResponder, Animated, type LayoutChangeEvent } from "react-native";
import { useDrawer } from "../../shared/contexts/DrawerContext";
import { IOS_SPRING } from "../../shared/constants/animations";
import { Icon } from "../../shared/components";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { useStreams } from "../../modules/streams/mobileStreamHooks";
import { useEntryCounts, useTags, useMentions } from "../../modules/entries/mobileEntryHooks";
import { useLocationsWithCounts } from "../../modules/locations/mobileLocationHooks";
import { StreamDrawerItem, QuickFilterItem } from "./StreamDrawerItem";
import { useNavigate } from "../../shared/navigation/hooks";
import * as ExpoLocation from "expo-location";
import { calculateDistance, formatDistanceWithUnits, getStateAbbreviation } from "@trace/core";
import { useSettings } from "../../shared/contexts/SettingsContext";
import type { Stream, LocationEntity } from "@trace/core";
import type { IconName } from "../../shared/components";

// ─── Tab Configuration ─────────────────────────────────────────────────────────

const TABS = [
  { key: "streams", icon: "Layers" as IconName },
  { key: "locations", icon: "MapPin" as IconName },
  { key: "tags", icon: "Hash" as IconName },
  { key: "mentions", icon: "AtSign" as IconName },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─── Stream Sort ────────────────────────────────────────────────────────────────

type StreamSortKey = "name" | "count" | "recent";

const SORT_OPTIONS: { key: StreamSortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "count", label: "Count" },
  { key: "recent", label: "Recent" },
];

function sortStreams(streams: Stream[], sortKey: StreamSortKey): Stream[] {
  const sorted = [...streams];
  switch (sortKey) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "count":
      return sorted.sort((a, b) => b.entry_count - a.entry_count);
    case "recent":
      return sorted.sort((a, b) => {
        const aDate = a.last_entry_updated_at ?? "";
        const bDate = b.last_entry_updated_at ?? "";
        if (bDate > aDate) return 1;
        if (bDate < aDate) return -1;
        return 0;
      });
  }
}

// ─── Tab Bar ────────────────────────────────────────────────────────────────────

interface DrawerTabBarProps {
  activeTab: TabKey;
  onTabPress: (key: TabKey) => void;
  accentColor: string;
  inactiveColor: string;
  borderColor: string;
  indicatorTranslateX: Animated.AnimatedInterpolation<number> | Animated.Value;
  indicatorWidth: number;
}

const DrawerTabBar = memo(function DrawerTabBar({
  activeTab,
  onTabPress,
  accentColor,
  inactiveColor,
  borderColor,
  indicatorTranslateX,
  indicatorWidth,
}: DrawerTabBarProps) {
  return (
    <View style={[tabBarStyles.container, { borderBottomColor: borderColor }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={tabBarStyles.tab}
            onPress={() => onTabPress(tab.key)}
            activeOpacity={0.6}
            delayPressIn={0}
          >
            <Icon
              name={tab.icon}
              size={20}
              color={isActive ? accentColor : inactiveColor}
            />
          </TouchableOpacity>
        );
      })}
      {indicatorWidth > 0 && (
        <Animated.View
          style={[
            tabBarStyles.indicator,
            {
              backgroundColor: accentColor,
              width: indicatorWidth,
              transform: [{ translateX: indicatorTranslateX }],
            },
          ]}
        />
      )}
    </View>
  );
});

const tabBarStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  indicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 2,
    borderRadius: 1,
  },
});

// ─── Location Sort ──────────────────────────────────────────────────────────────

type LocationSortKey = "name" | "city" | "count" | "distance";

type LocationWithCount = LocationEntity & { entry_count: number };

interface LocationGroup {
  header: string;
  locations: LocationWithCount[];
}

function getDistanceMeters(
  userLat: number, userLng: number, locLat: number, locLng: number,
): number {
  return calculateDistance(
    { latitude: userLat, longitude: userLng },
    { latitude: locLat, longitude: locLng },
  ).meters;
}

function getLocationSubtitle(loc: LocationEntity): string {
  const isUSA = loc.country === "United States" || loc.country === "USA" || loc.country === "US";
  if (isUSA && loc.city && loc.region) {
    return `${loc.city}, ${getStateAbbreviation(loc.region)}`;
  }
  return [loc.city, loc.country].filter(Boolean).join(", ");
}

function getCityGroupKey(loc: LocationEntity): string {
  return getLocationSubtitle(loc) || "Unknown";
}

function groupLocationsByCity(locations: LocationWithCount[]): LocationGroup[] {
  const groups = new Map<string, LocationWithCount[]>();
  for (const loc of locations) {
    const key = getCityGroupKey(loc);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(loc);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([header, locs]) => ({
      header,
      locations: locs.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function StreamDrawerContent() {
  const theme = useTheme();

  const drawerTextPrimary = theme.colors.surface.drawerText || theme.colors.text.primary;
  const drawerTextSecondary = theme.colors.surface.drawerTextSecondary || theme.colors.text.secondary;
  const drawerTextTertiary = theme.colors.surface.drawerTextTertiary || theme.colors.text.tertiary;

  const {
    closeDrawer,
    onStreamSelect,
    onStreamLongPress,
    selectedStreamId,
    setSelectedStreamId,
    setSelectedStreamName,
  } = useDrawer();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { streams } = useStreams();
  const { data: entryCounts } = useEntryCounts();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("streams");
  const activeTabIndexRef = useRef(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerWidthRef = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const streamScrollRef = useRef<ScrollView>(null);
  const locationScrollRef = useRef<ScrollView>(null);

  // Stream sort
  const [streamSort, setStreamSort] = useState<StreamSortKey>("name");
  const [streamSortAsc, setStreamSortAsc] = useState(true);

  // Keep ref in sync with state
  useEffect(() => {
    activeTabIndexRef.current = TABS.findIndex((t) => t.key === activeTab);
  }, [activeTab]);

  // Location sort + GPS state
  const [locationSort, setLocationSort] = useState<LocationSortKey>("name");
  const [locationSortAsc, setLocationSortAsc] = useState(true);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);

  // Check GPS permission on mount (non-blocking, no prompt)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (cancelled || status !== "granted") return;
      let pos = await ExpoLocation.getLastKnownPositionAsync();
      if (!pos) {
        pos = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Low,
        });
      }
      if (!cancelled && pos) {
        setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Data hooks
  const { data: locationsWithCounts } = useLocationsWithCounts();
  const locations = locationsWithCounts ?? [];
  const { tags } = useTags();
  const { mentions } = useMentions();

  const allEntriesCount = entryCounts?.total || 0;
  const noStreamCount = entryCounts?.noStream || 0;

  const sortedTags = useMemo(() => {
    return [...tags]
      .sort((a, b) => a.tag.toLowerCase().localeCompare(b.tag.toLowerCase()))
      .map((t) => ({
        label: `#${t.tag}`,
        value: t.tag,
        count: t.count,
      }));
  }, [tags]);

  const sortedMentions = useMemo(() => {
    return [...mentions]
      .sort((a, b) => a.mention.toLowerCase().localeCompare(b.mention.toLowerCase()))
      .map((m) => ({
        label: `@${m.mention}`,
        value: m.mention,
        count: m.count,
      }));
  }, [mentions]);

  // Sorted streams
  const sortedStreams = useMemo(() => {
    const sorted = sortStreams(streams, streamSort);
    return streamSortAsc ? sorted : sorted.reverse();
  }, [streams, streamSort, streamSortAsc]);

  // Location sort options (Distance only available with GPS)
  const locationSortOptions = useMemo(() => {
    const opts: { key: LocationSortKey; label: string }[] = [
      { key: "name", label: "Name" },
      { key: "city", label: "City" },
      { key: "count", label: "Count" },
    ];
    if (userPosition) {
      opts.push({ key: "distance", label: "Distance" });
    }
    return opts;
  }, [userPosition]);

  // Sorted/grouped locations
  const sortedLocations = useMemo(() => {
    if (locationSort === "city") return null;
    const sorted = [...locations];
    switch (locationSort) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "count":
        sorted.sort((a, b) => b.entry_count - a.entry_count);
        break;
      case "distance":
        if (userPosition) {
          sorted.sort((a, b) => {
            const distA = getDistanceMeters(userPosition.lat, userPosition.lng, a.latitude, a.longitude);
            const distB = getDistanceMeters(userPosition.lat, userPosition.lng, b.latitude, b.longitude);
            return distA - distB;
          });
        }
        break;
    }
    return locationSortAsc ? sorted : sorted.reverse();
  }, [locations, locationSort, userPosition, locationSortAsc]);

  const groupedLocations = useMemo(() => {
    if (locationSort !== "city") return null;
    const groups = groupLocationsByCity(locations);
    return locationSortAsc ? groups : groups.reverse();
  }, [locations, locationSort, locationSortAsc]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleStreamSelect = useCallback(
    (streamId: string | null, streamName: string) => {
      setSelectedStreamId(streamId);
      setSelectedStreamName(streamName);
      if (onStreamSelect) {
        onStreamSelect(streamId, streamName);
      }
      closeDrawer();
    },
    [onStreamSelect, closeDrawer, setSelectedStreamId, setSelectedStreamName],
  );

  const handleStreamLongPress = useCallback(
    (streamId: string) => {
      closeDrawer();
      if (onStreamLongPress) {
        onStreamLongPress(streamId);
      }
    },
    [onStreamLongPress, closeDrawer],
  );

  const handleLocationSelect = useCallback(
    (location: LocationWithCount) => {
      const filterId = `location:${location.location_id}`;
      setSelectedStreamId(filterId);
      setSelectedStreamName(location.name);
      if (onStreamSelect) {
        onStreamSelect(filterId, location.name);
      }
      closeDrawer();
    },
    [onStreamSelect, closeDrawer, setSelectedStreamId, setSelectedStreamName],
  );

  const handleManageLocations = useCallback(() => {
    closeDrawer();
    navigate("locations");
  }, [closeDrawer, navigate]);

  const handleTagSelect = useCallback(
    (type: "tag" | "mention", value: string, label: string) => {
      const filterId = `${type}:${value}`;
      setSelectedStreamId(filterId);
      setSelectedStreamName(label);
      if (onStreamSelect) {
        onStreamSelect(filterId, label);
      }
      closeDrawer();
    },
    [onStreamSelect, closeDrawer, setSelectedStreamId, setSelectedStreamName],
  );

  const handleManageStreams = useCallback(() => {
    closeDrawer();
    navigate("streams");
  }, [closeDrawer, navigate]);

  const handleStreamSortPress = useCallback((key: StreamSortKey) => {
    if (key === streamSort) {
      setStreamSortAsc(prev => !prev);
    } else {
      setStreamSort(key);
      setStreamSortAsc(true);
    }
    streamScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [streamSort]);

  const handleLocationSortPress = useCallback((key: LocationSortKey) => {
    if (key === locationSort) {
      setLocationSortAsc(prev => !prev);
    } else {
      setLocationSort(key);
      setLocationSortAsc(true);
    }
    locationScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [locationSort]);

  // ─── Tab Animation ──────────────────────────────────────────────────────

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    containerWidthRef.current = w;
    setContainerWidth(w);
    // Snap to current tab position without animation
    translateX.setValue(-activeTabIndexRef.current * w);
  }, [translateX]);

  const animateToTab = useCallback((index: number) => {
    activeTabIndexRef.current = index;
    setActiveTab(TABS[index].key);
    Animated.spring(translateX, {
      toValue: -index * containerWidthRef.current,
      ...IOS_SPRING,
    }).start();
  }, [translateX]);

  const handleTabPress = useCallback((key: TabKey) => {
    const index = TABS.findIndex(t => t.key === key);
    if (index >= 0) animateToTab(index);
  }, [animateToTab]);

  // Derived indicator animation (slides with content)
  const tabWidth = containerWidth / TABS.length;
  const indicatorWidth = Math.max(0, tabWidth - 32);
  const indicatorTranslateX = useMemo(() => {
    if (containerWidth <= 0) return translateX;
    const tw = containerWidth / TABS.length;
    // inputRange must be ascending: [-900, -600, -300, 0]
    const lastIdx = TABS.length - 1;
    return translateX.interpolate({
      inputRange: TABS.map((_, i) => -(lastIdx - i) * containerWidth),
      outputRange: TABS.map((_, i) => (lastIdx - i) * tw + 16),
      extrapolate: "clamp",
    });
  }, [translateX, containerWidth]);

  // PanResponder: finger tracking + flick detection
  const contentPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        const isHorizontal = Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy);
        if (!isHorizontal) return false;
        const idx = activeTabIndexRef.current;
        // First tab + swipe right → let drawer close gesture handle it
        if (idx === 0 && gs.dx > 0) return false;
        // Last tab + swipe left → nothing to switch to
        if (idx === TABS.length - 1 && gs.dx < 0) return false;
        return true;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => {
        const base = -activeTabIndexRef.current * containerWidthRef.current;
        const proposed = base + gs.dx * 1.5;
        const minX = -(TABS.length - 1) * containerWidthRef.current;
        translateX.setValue(Math.max(minX, Math.min(0, proposed)));
      },
      onPanResponderRelease: (_, gs) => {
        const width = containerWidthRef.current;
        const currentPos = -activeTabIndexRef.current * width + gs.dx * 1.5;
        // Add velocity momentum so flicks jump further
        const projected = currentPos + gs.vx * 1.5 * 350;
        // Snap to nearest tab
        let targetIdx = Math.round(-projected / width);
        targetIdx = Math.max(0, Math.min(TABS.length - 1, targetIdx));

        activeTabIndexRef.current = targetIdx;
        setActiveTab(TABS[targetIdx].key);
        Animated.spring(translateX, {
          toValue: -targetIdx * containerWidthRef.current,
          ...IOS_SPRING,
        }).start();
      },
    }),
  ).current;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <DrawerTabBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        accentColor={theme.colors.functional.accent}
        inactiveColor={drawerTextTertiary}
        borderColor={theme.colors.border.light}
        indicatorTranslateX={indicatorTranslateX}
        indicatorWidth={indicatorWidth}
      />

      <View style={styles.tabContent} onLayout={handleLayout}>
        {containerWidth > 0 && (
          <Animated.View
            style={[styles.tabStrip, { width: containerWidth * TABS.length, transform: [{ translateX }] }]}
            {...contentPanResponder.panHandlers}
          >
            {/* ── Streams Tab ── */}
            <View style={{ width: containerWidth }}>
              {/* Sort bar + manage link */}
              <View style={[styles.sortBar, { backgroundColor: theme.colors.background.tertiary, borderBottomColor: theme.colors.border.light }]}>
                <View style={styles.sortChips}>
                  {SORT_OPTIONS.map((opt) => {
                    const isActive = streamSort === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.sortChip,
                          { backgroundColor: isActive
                            ? theme.colors.functional.accent
                            : theme.colors.background.secondary },
                        ]}
                        onPress={() => handleStreamSortPress(opt.key)}
                        activeOpacity={0.6}
                        delayPressIn={0}
                        hitSlop={{ top: 10, bottom: 10, left: 0, right: 0 }}
                      >
                        <Text
                          style={[
                            styles.sortChipText,
                            { color: isActive ? "#FFFFFF" : drawerTextSecondary },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  onPress={handleManageStreams}
                  activeOpacity={0.6}
                  delayPressIn={0}
                  style={{ padding: 8 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="Settings" size={16} color={drawerTextTertiary} />
                </TouchableOpacity>
              </View>

              {/* Fixed quick filters */}
              <View style={[styles.quickFilters, { backgroundColor: theme.colors.surface.overlay }]}>
                <QuickFilterItem
                  label="All Entries"
                  count={allEntriesCount}
                  isSelected={selectedStreamId === "all"}
                  onPress={() => handleStreamSelect("all", "All Entries")}
                  textColor={drawerTextPrimary}
                  textColorSecondary={drawerTextSecondary}
                  textColorTertiary={drawerTextTertiary}
                />
                <QuickFilterItem
                  label="Inbox"
                  icon="Inbox"
                  count={noStreamCount}
                  isSelected={selectedStreamId === null}
                  onPress={() => handleStreamSelect(null, "Inbox")}
                  textColor={drawerTextPrimary}
                  textColorSecondary={drawerTextSecondary}
                  textColorTertiary={drawerTextTertiary}
                />
              </View>

              {/* Scrollable stream list */}
              <ScrollView ref={streamScrollRef} style={styles.scrollContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {sortedStreams.map((stream) => (
                  <StreamDrawerItem
                    key={stream.stream_id}
                    stream={stream}
                    isSelected={selectedStreamId === stream.stream_id}
                    onPress={() => handleStreamSelect(stream.stream_id, stream.name)}
                    onLongPress={() => handleStreamLongPress(stream.stream_id)}
                    textColor={drawerTextPrimary}
                    textColorSecondary={drawerTextSecondary}
                    textColorTertiary={drawerTextTertiary}
                  />
                ))}
                <View style={styles.bottomPadding} />
              </ScrollView>
            </View>

            {/* ── Locations Tab ── */}
            <View style={{ width: containerWidth }}>
              {/* Sort bar + manage link */}
              <View style={[styles.sortBar, { backgroundColor: theme.colors.background.tertiary, borderBottomColor: theme.colors.border.light }]}>
                <View style={styles.sortChips}>
                  {locationSortOptions.map((opt) => {
                    const isActive = locationSort === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.sortChip,
                          { backgroundColor: isActive
                            ? theme.colors.functional.accent
                            : theme.colors.background.secondary },
                        ]}
                        onPress={() => handleLocationSortPress(opt.key)}
                        activeOpacity={0.6}
                        delayPressIn={0}
                        hitSlop={{ top: 10, bottom: 10, left: 0, right: 0 }}
                      >
                        <Text
                          style={[
                            styles.sortChipText,
                            { color: isActive ? "#FFFFFF" : drawerTextSecondary },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  onPress={handleManageLocations}
                  activeOpacity={0.6}
                  delayPressIn={0}
                  style={{ padding: 8 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="Settings" size={16} color={drawerTextTertiary} />
                </TouchableOpacity>
              </View>

              <ScrollView ref={locationScrollRef} style={styles.scrollContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {locations.length > 0 ? (
                  locationSort === "city" && groupedLocations ? (
                    groupedLocations.map((group) => (
                      <View key={group.header}>
                        <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.border.light }]}>
                          <Text
                            style={[styles.sectionHeaderText, { color: drawerTextSecondary }]}
                            numberOfLines={1}
                          >
                            {group.header}
                          </Text>
                        </View>
                        {group.locations.map((loc) => {
                          const filterId = `location:${loc.location_id}`;
                          const isSelected = selectedStreamId === filterId;
                          return (
                            <TouchableOpacity
                              key={loc.location_id}
                              style={[
                                styles.filterItem,
                                styles.groupedItem,
                                isSelected && { backgroundColor: theme.colors.background.tertiary },
                              ]}
                              onPress={() => handleLocationSelect(loc)}
                              activeOpacity={0.6}
                              delayPressIn={0}
                            >
                              <View style={styles.locationItemText}>
                                <Text
                                  style={[
                                    styles.locationItemName,
                                    { color: drawerTextPrimary },
                                    isSelected && { fontFamily: theme.typography.fontFamily.semibold },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {loc.name}
                                </Text>
                              </View>
                              {loc.entry_count > 0 && (
                                <Text
                                  style={[
                                    styles.filterCount,
                                    { color: drawerTextTertiary },
                                    isSelected && { color: drawerTextSecondary },
                                  ]}
                                >
                                  {loc.entry_count}
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))
                  ) : (
                    (sortedLocations ?? []).map((loc) => {
                      const filterId = `location:${loc.location_id}`;
                      const isSelected = selectedStreamId === filterId;
                      const locSubtitle = getLocationSubtitle(loc);
                      const distance =
                        locationSort === "distance" && userPosition
                          ? formatDistanceWithUnits(getDistanceMeters(userPosition.lat, userPosition.lng, loc.latitude, loc.longitude), settings.units)
                          : null;
                      const subtitle = distance
                        ? (locSubtitle ? `${locSubtitle} · ${distance}` : distance)
                        : locSubtitle;
                      return (
                        <TouchableOpacity
                          key={loc.location_id}
                          style={[
                            styles.filterItem,
                            isSelected && { backgroundColor: theme.colors.background.tertiary },
                          ]}
                          onPress={() => handleLocationSelect(loc)}
                          activeOpacity={0.6}
                          delayPressIn={0}
                        >
                          <View style={styles.locationItemText}>
                            <Text
                              style={[
                                styles.locationItemName,
                                { color: drawerTextPrimary },
                                isSelected && { fontFamily: theme.typography.fontFamily.semibold },
                              ]}
                              numberOfLines={1}
                            >
                              {loc.name}
                            </Text>
                            {subtitle ? (
                              <Text
                                style={[styles.locationItemSubtitle, { color: drawerTextTertiary }]}
                                numberOfLines={1}
                              >
                                {subtitle}
                              </Text>
                            ) : null}
                          </View>
                          {loc.entry_count > 0 && (
                            <Text
                              style={[
                                styles.filterCount,
                                { color: drawerTextTertiary },
                                isSelected && { color: drawerTextSecondary },
                              ]}
                            >
                              {loc.entry_count}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyText, { color: drawerTextTertiary }]}>
                      No locations yet
                    </Text>
                  </View>
                )}
                <View style={styles.bottomPadding} />
              </ScrollView>
            </View>

            {/* ── Tags Tab ── */}
            <View style={{ width: containerWidth }}>
              <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {sortedTags.length > 0 ? (
                  sortedTags.map((item) => {
                    const isSelected = selectedStreamId === `tag:${item.value}`;
                    return (
                      <TouchableOpacity
                        key={`tag:${item.value}`}
                        style={[
                          styles.filterItem,
                          isSelected && { backgroundColor: theme.colors.background.tertiary },
                        ]}
                        onPress={() => handleTagSelect("tag", item.value, item.label)}
                        activeOpacity={0.6}
                        delayPressIn={0}
                      >
                        <Text
                          style={[
                            styles.filterLabel,
                            { color: drawerTextPrimary },
                            isSelected && { fontFamily: theme.typography.fontFamily.semibold },
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                        {item.count > 0 && (
                          <Text
                            style={[
                              styles.filterCount,
                              { color: drawerTextTertiary },
                              isSelected && { color: drawerTextSecondary },
                            ]}
                          >
                            {item.count}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyText, { color: drawerTextTertiary }]}>
                      No tags yet
                    </Text>
                  </View>
                )}
                <View style={styles.bottomPadding} />
              </ScrollView>
            </View>

            {/* ── Mentions Tab ── */}
            <View style={{ width: containerWidth }}>
              <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {sortedMentions.length > 0 ? (
                  sortedMentions.map((item) => {
                    const isSelected = selectedStreamId === `mention:${item.value}`;
                    return (
                      <TouchableOpacity
                        key={`mention:${item.value}`}
                        style={[
                          styles.filterItem,
                          isSelected && { backgroundColor: theme.colors.background.tertiary },
                        ]}
                        onPress={() => handleTagSelect("mention", item.value, item.label)}
                        activeOpacity={0.6}
                        delayPressIn={0}
                      >
                        <Text
                          style={[
                            styles.filterLabel,
                            { color: drawerTextPrimary },
                            isSelected && { fontFamily: theme.typography.fontFamily.semibold },
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                        {item.count > 0 && (
                          <Text
                            style={[
                              styles.filterCount,
                              { color: drawerTextTertiary },
                              isSelected && { color: drawerTextSecondary },
                            ]}
                          >
                            {item.count}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyText, { color: drawerTextTertiary }]}>
                      No mentions yet
                    </Text>
                  </View>
                )}
                <View style={styles.bottomPadding} />
              </ScrollView>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    overflow: "hidden",
  },
  tabStrip: {
    flexDirection: "row" as const,
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  quickFilters: {
    paddingTop: 4,
    paddingBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1,
  },
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortChips: {
    flexDirection: "row",
    gap: 6,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 28,
  },
  sortChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  // Shared item styles for tags/mentions/locations
  filterItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    borderRadius: 8,
  },
  filterLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  filterCount: {
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 12,
  },
  // Location list items
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    marginTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "600",
  },
  groupedItem: {
    paddingLeft: 32,
  },
  locationItemText: {
    flex: 1,
    marginRight: 8,
  },
  locationItemName: {
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  locationItemSubtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 14,
  },
  bottomPadding: {
    height: 32,
  },
});
