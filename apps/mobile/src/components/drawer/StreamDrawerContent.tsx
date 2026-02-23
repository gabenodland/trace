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
import { useTheme, type ThemeContextValue } from "../../shared/contexts/ThemeContext";
import { useStreams } from "../../modules/streams/mobileStreamHooks";
import { useEntryCounts, useTags, useMentions } from "../../modules/entries/mobileEntryHooks";
import { useEntryDerivedPlaces } from "../../modules/locations/mobileLocationHooks";
import { StreamDrawerItem, QuickFilterItem } from "./StreamDrawerItem";
import { useNavigate } from "../../shared/navigation/hooks";
import * as ExpoLocation from "expo-location";
import { calculateDistance, formatDistanceWithUnits, getStateAbbreviation } from "@trace/core";
import { useSettings } from "../../shared/contexts/SettingsContext";
import type { Stream } from "@trace/core";
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

interface EntryDerivedPlace {
  place_name: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  entry_count: number;
  avg_latitude: number;
  avg_longitude: number;
  is_favorite: boolean;
  location_id: string | null;
  ungeocoded_count: number;
}

interface PlaceGroup {
  header: string;
  places: DrawerPlaceItem[];
}

/** A display item in the drawer: either an individual place or a collapsed city group */
type DrawerPlaceItem =
  | { kind: "place"; place: EntryDerivedPlace }
  | { kind: "city_group"; city: string | null; region: string | null; country: string | null; entry_count: number; avg_latitude: number; avg_longitude: number };

function getDistanceMeters(
  userLat: number, userLng: number, locLat: number, locLng: number,
): number {
  return calculateDistance(
    { latitude: userLat, longitude: userLng },
    { latitude: locLat, longitude: locLng },
  ).meters;
}

function getPlaceLabel(place: EntryDerivedPlace): string {
  return place.place_name || place.address || place.city || "Unknown Place";
}

function formatCityLine(city: string | null, region: string | null, country: string | null): string {
  const isUSA = country === "United States" || country === "USA" || country === "US";
  const isCanada = country === "Canada";
  if ((isUSA || isCanada) && city && region) {
    return `${city}, ${getStateAbbreviation(region)}`;
  }
  return [city, country].filter(Boolean).join(", ");
}

function getPlaceCityLine(place: EntryDerivedPlace): string {
  return formatCityLine(place.city, place.region, place.country);
}

function getDrawerItemLabel(item: DrawerPlaceItem): string {
  if (item.kind === "place") return getPlaceLabel(item.place);
  return formatCityLine(item.city, item.region, item.country) || "Unknown";
}

function getDrawerItemEntryCount(item: DrawerPlaceItem): number {
  if (item.kind === "place") return item.place.entry_count;
  return item.entry_count;
}

/**
 * Collapse unnamed places by city for drawer display.
 * Named places (with place_name) stay individual.
 * Unnamed places in the same city become a single "city_group" row.
 */
function collapsePlaces(places: EntryDerivedPlace[]): DrawerPlaceItem[] {
  const items: DrawerPlaceItem[] = [];
  const unnamedByCity = new Map<string, { city: string | null; region: string | null; country: string | null; totalEntries: number; latSum: number; lngSum: number; count: number }>();

  for (const p of places) {
    if (p.place_name) {
      items.push({ kind: "place", place: p });
    } else {
      const key = formatCityLine(p.city, p.region, p.country) || "Unknown";
      const existing = unnamedByCity.get(key);
      if (existing) {
        existing.totalEntries += p.entry_count;
        existing.latSum += p.avg_latitude;
        existing.lngSum += p.avg_longitude;
        existing.count += 1;
      } else {
        unnamedByCity.set(key, { city: p.city, region: p.region, country: p.country, totalEntries: p.entry_count, latSum: p.avg_latitude, lngSum: p.avg_longitude, count: 1 });
      }
    }
  }

  for (const [, group] of unnamedByCity) {
    items.push({
      kind: "city_group",
      city: group.city,
      region: group.region,
      country: group.country,
      entry_count: group.totalEntries,
      avg_latitude: group.count > 0 ? group.latSum / group.count : 0,
      avg_longitude: group.count > 0 ? group.lngSum / group.count : 0,
    });
  }

  return items;
}

function getDrawerItemCityGroupKey(item: DrawerPlaceItem): string {
  if (item.kind === "place") return getPlaceCityLine(item.place) || "Unknown";
  return formatCityLine(item.city, item.region, item.country) || "Unknown";
}

function groupDrawerItemsByCity(items: DrawerPlaceItem[]): PlaceGroup[] {
  const groups = new Map<string, DrawerPlaceItem[]>();
  for (const item of items) {
    const key = getDrawerItemCityGroupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([header, groupItems]) => ({
      header,
      places: groupItems.sort((a, b) => getDrawerItemLabel(a).localeCompare(getDrawerItemLabel(b))),
    }));
}

// ─── Drawer Location Row ────────────────────────────────────────────────────────

interface DrawerLocationRowProps {
  item: DrawerPlaceItem;
  isGrouped: boolean;
  selectedStreamId: string | null;
  locationSort: LocationSortKey;
  userPosition: { lat: number; lng: number } | null;
  units: "metric" | "imperial";
  theme: ThemeContextValue;
  drawerTextPrimary: string;
  drawerTextSecondary: string;
  drawerTextTertiary: string;
  onPress: (item: DrawerPlaceItem) => void;
}

function getDrawerItemFilterId(item: DrawerPlaceItem): string {
  if (item.kind === "place") {
    const p = item.place;
    return p.is_favorite && p.location_id
      ? `location:${p.location_id}`
      : `geo:place:${p.place_name || ""}||${p.address || ""}||${p.city || ""}||${p.region || ""}||${p.country || ""}`;
  }
  return `geo:unnamed-city:${item.city || ""}:${item.region || ""}:${item.country || ""}`;
}

const DrawerLocationRow = memo(function DrawerLocationRow({
  item, isGrouped, selectedStreamId, locationSort, userPosition, units,
  theme, drawerTextPrimary, drawerTextSecondary, drawerTextTertiary, onPress,
}: DrawerLocationRowProps) {
  const filterId = getDrawerItemFilterId(item);
  const isSelected = selectedStreamId === filterId;
  const label = getDrawerItemLabel(item);
  const entryCount = getDrawerItemEntryCount(item);
  const isFavorite = item.kind === "place" && item.place.is_favorite;
  const isCityGroup = item.kind === "city_group";

  // Subtitle for flat list (non-grouped) view
  let subtitle: string | null = null;
  if (!isGrouped && item.kind === "place") {
    const cityLine = getPlaceCityLine(item.place);
    if (locationSort === "distance" && userPosition) {
      const dist = formatDistanceWithUnits(
        getDistanceMeters(userPosition.lat, userPosition.lng, item.place.avg_latitude, item.place.avg_longitude),
        units,
      );
      subtitle = cityLine ? `${cityLine} · ${dist}` : dist;
    } else {
      subtitle = cityLine;
    }
  }

  return (
    <TouchableOpacity
      style={[
        styles.filterItem,
        styles.locationItem,
        isGrouped && styles.groupedItem,
        isSelected && { backgroundColor: theme.colors.background.tertiary },
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.6}
      delayPressIn={0}
    >
      <Icon
        name={isFavorite ? "MapPinFavoriteLine" : (item.kind === "place" && item.place.place_name) ? "MapPin" : "MapPinEmpty"}
        size={12}
        color={isFavorite ? theme.colors.functional.accent : drawerTextTertiary}
        style={styles.locationIcon}
      />
      <View style={styles.locationItemText}>
        <Text
          style={[
            styles.locationItemName,
            { color: drawerTextPrimary },
            isCityGroup && { fontStyle: "italic" },
            isSelected && { fontFamily: theme.typography.fontFamily.semibold },
          ]}
          numberOfLines={1}
        >
          {isCityGroup ? `Unnamed · ${label}` : label}
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
      {entryCount > 0 && (
        <Text
          style={[
            styles.filterCount,
            { color: drawerTextTertiary },
            isSelected && { color: drawerTextSecondary },
          ]}
        >
          {entryCount}
        </Text>
      )}
    </TouchableOpacity>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────────

export const StreamDrawerContent = memo(function StreamDrawerContent() {
  const theme = useTheme();

  const drawerTextPrimary = theme.colors.surface.drawerText || theme.colors.text.primary;
  const drawerTextSecondary = theme.colors.surface.drawerTextSecondary || theme.colors.text.secondary;
  const drawerTextTertiary = theme.colors.surface.drawerTextTertiary || theme.colors.text.tertiary;

  const {
    closeDrawer,
    drawerControl,
    onStreamSelect,
    onStreamLongPress,
    selectedStreamId,
    setSelectedStreamId,
    setSelectedStreamName,
  } = useDrawer();

  // Prefer animated close (spring) over raw closeDrawer (instant snap)
  const animatedClose = useCallback(() => {
    if (drawerControl?.animateClose) {
      drawerControl.animateClose();
    } else {
      closeDrawer();
    }
  }, [drawerControl, closeDrawer]);
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
  const lastTranslateXRef = useRef(0);
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
  const { data: entryDerivedData } = useEntryDerivedPlaces();
  const places: EntryDerivedPlace[] = (entryDerivedData ?? []) as EntryDerivedPlace[];
  const { tags } = useTags();
  const { mentions } = useMentions();

  const allEntriesCount = entryCounts?.total || 0;
  const noStreamCount = entryCounts?.noStream || 0;
  const hasPlaceCount = entryCounts?.hasPlace || 0;
  const noPlaceCount = entryCounts?.noPlace || 0;

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

  // Collapse unnamed places by city for drawer display
  const drawerItems = useMemo(() => collapsePlaces(places), [places]);

  // Sorted/grouped drawer items
  const sortedItems = useMemo(() => {
    if (locationSort === "city") return null;
    const sorted = [...drawerItems];
    switch (locationSort) {
      case "name":
        sorted.sort((a, b) => getDrawerItemLabel(a).localeCompare(getDrawerItemLabel(b)));
        break;
      case "count":
        sorted.sort((a, b) => getDrawerItemEntryCount(b) - getDrawerItemEntryCount(a));
        break;
      case "distance":
        if (userPosition) {
          sorted.sort((a, b) => {
            const aLat = a.kind === "place" ? a.place.avg_latitude : a.avg_latitude;
            const aLng = a.kind === "place" ? a.place.avg_longitude : a.avg_longitude;
            const bLat = b.kind === "place" ? b.place.avg_latitude : b.avg_latitude;
            const bLng = b.kind === "place" ? b.place.avg_longitude : b.avg_longitude;
            return getDistanceMeters(userPosition.lat, userPosition.lng, aLat, aLng)
              - getDistanceMeters(userPosition.lat, userPosition.lng, bLat, bLng);
          });
        }
        break;
    }
    return locationSortAsc ? sorted : sorted.reverse();
  }, [drawerItems, locationSort, userPosition, locationSortAsc]);

  const groupedItems = useMemo(() => {
    if (locationSort !== "city") return null;
    const groups = groupDrawerItemsByCity(drawerItems);
    return locationSortAsc ? groups : groups.reverse();
  }, [drawerItems, locationSort, locationSortAsc]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleStreamSelect = useCallback(
    (streamId: string | null, streamName: string) => {
      setSelectedStreamId(streamId);
      setSelectedStreamName(streamName);
      if (onStreamSelect) {
        onStreamSelect(streamId, streamName);
      }
      animatedClose();
    },
    [onStreamSelect, animatedClose, setSelectedStreamId, setSelectedStreamName],
  );

  const handleStreamLongPress = useCallback(
    (streamId: string) => {
      animatedClose();
      if (onStreamLongPress) {
        onStreamLongPress(streamId);
      }
    },
    [onStreamLongPress, animatedClose],
  );

  const handleDrawerItemSelect = useCallback(
    (item: DrawerPlaceItem) => {
      const filterId = getDrawerItemFilterId(item);
      let label: string;

      if (item.kind === "place") {
        label = getPlaceLabel(item.place);
      } else {
        const cityLabel = formatCityLine(item.city, item.region, item.country);
        label = cityLabel ? `Unnamed · ${cityLabel}` : "Unnamed Places";
      }

      setSelectedStreamId(filterId);
      setSelectedStreamName(label);
      if (onStreamSelect) {
        onStreamSelect(filterId, label);
      }
      animatedClose();
    },
    [onStreamSelect, animatedClose, setSelectedStreamId, setSelectedStreamName],
  );

  const handleManageLocations = useCallback(() => {
    animatedClose();
    navigate("locations");
  }, [animatedClose, navigate]);

  const handleTagSelect = useCallback(
    (type: "tag" | "mention", value: string, label: string) => {
      const filterId = `${type}:${value}`;
      setSelectedStreamId(filterId);
      setSelectedStreamName(label);
      if (onStreamSelect) {
        onStreamSelect(filterId, label);
      }
      animatedClose();
    },
    [onStreamSelect, animatedClose, setSelectedStreamId, setSelectedStreamName],
  );

  const handleManageStreams = useCallback(() => {
    animatedClose();
    navigate("streams");
  }, [animatedClose, navigate]);

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
    const val = -activeTabIndexRef.current * w;
    translateX.setValue(val);
    lastTranslateXRef.current = val;
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
        const clamped = Math.max(minX, Math.min(0, proposed));
        lastTranslateXRef.current = clamped;
        translateX.setValue(clamped);
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
      onPanResponderTerminate: () => {
        // ScrollView native gesture stole the touch — snap to nearest tab
        const width = containerWidthRef.current;
        if (width <= 0) return;
        let targetIdx = Math.round(-lastTranslateXRef.current / width);
        targetIdx = Math.max(0, Math.min(TABS.length - 1, targetIdx));
        activeTabIndexRef.current = targetIdx;
        setActiveTab(TABS[targetIdx].key);
        Animated.spring(translateX, {
          toValue: -targetIdx * width,
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
                          {opt.label}{isActive ? (streamSortAsc ? " ↓" : " ↑") : ""}
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
                          {opt.label}{isActive ? (locationSortAsc ? " ↓" : " ↑") : ""}
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

              {/* Fixed location quick filters */}
              <View style={[styles.quickFilters, { backgroundColor: theme.colors.surface.overlay }]}>
                <QuickFilterItem
                  label="Has Place"
                  icon="MapPin"
                  count={hasPlaceCount}
                  isSelected={selectedStreamId === "has-place"}
                  onPress={() => handleStreamSelect("has-place", "Has Place")}
                  textColor={drawerTextPrimary}
                  textColorSecondary={drawerTextSecondary}
                  textColorTertiary={drawerTextTertiary}
                />
                <QuickFilterItem
                  label="No Place"
                  icon="MapPinOff"
                  count={noPlaceCount}
                  isSelected={selectedStreamId === "no-place"}
                  onPress={() => handleStreamSelect("no-place", "No Place")}
                  textColor={drawerTextPrimary}
                  textColorSecondary={drawerTextSecondary}
                  textColorTertiary={drawerTextTertiary}
                />
              </View>

              <ScrollView ref={locationScrollRef} style={styles.scrollContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {drawerItems.length > 0 ? (
                  locationSort === "city" && groupedItems ? (
                    groupedItems.map((group: PlaceGroup) => (
                      <View key={group.header}>
                        <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.border.light }]}>
                          <Text
                            style={[styles.sectionHeaderText, { color: drawerTextSecondary }]}
                            numberOfLines={1}
                          >
                            {group.header}
                          </Text>
                        </View>
                        {group.places.map((item: DrawerPlaceItem) => {
                          const itemKey = item.kind === "place"
                            ? `p|${item.place.place_name || ""}|${item.place.address || ""}|${item.place.city || ""}|${item.place.region || ""}|${item.place.country || ""}`
                            : `cg|${item.city || ""}|${item.region || ""}`;
                          return (
                            <DrawerLocationRow
                              key={itemKey}
                              item={item}
                              isGrouped
                              selectedStreamId={selectedStreamId}
                              locationSort={locationSort}
                              userPosition={userPosition}
                              units={settings.units}
                              theme={theme}
                              drawerTextPrimary={drawerTextPrimary}
                              drawerTextSecondary={drawerTextSecondary}
                              drawerTextTertiary={drawerTextTertiary}
                              onPress={handleDrawerItemSelect}
                            />
                          );
                        })}
                      </View>
                    ))
                  ) : (
                    (sortedItems ?? []).map((item: DrawerPlaceItem) => {
                      const itemKey = item.kind === "place"
                        ? `p|${item.place.place_name || ""}|${item.place.address || ""}|${item.place.city || ""}|${item.place.region || ""}|${item.place.country || ""}`
                        : `cg|${item.city || ""}|${item.region || ""}`;
                      return (
                        <DrawerLocationRow
                          key={itemKey}
                          item={item}
                          isGrouped={false}
                          selectedStreamId={selectedStreamId}
                          locationSort={locationSort}
                          userPosition={userPosition}
                          units={settings.units}
                          theme={theme}
                          drawerTextPrimary={drawerTextPrimary}
                          drawerTextSecondary={drawerTextSecondary}
                          drawerTextTertiary={drawerTextTertiary}
                          onPress={handleDrawerItemSelect}
                        />
                      );
                    })
                  )
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyText, { color: drawerTextTertiary }]}>
                      No places yet
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
});

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
  // Location list items — override shared filterItem's center alignment
  locationItem: {
    alignItems: "flex-start",
  },
  locationIcon: {
    marginTop: 4,
    marginRight: 6,
  },
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
