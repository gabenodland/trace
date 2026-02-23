/**
 * LocationsScreen — Place Management
 *
 * All places from entry data + saved locations with 0 entries (unified via SQL UNION).
 * Search, issue badges, per-row action sheets for managing individual places.
 */

import { useState, useMemo, useCallback, useEffect, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import * as ExpoLocation from "expo-location";
import { createScopedLogger, LogScopes } from "../shared/utils/logger";
import { Icon, EmptyState, LoadingState, SortBar, Snackbar, useSnackbar, type SortOption } from "../shared/components";
import type { IconName } from "../shared/components";
import {
  useEntryDerivedPlaces,
  useDeleteLocation,
  useEnrichSingleLocation,
  usePromoteEntryPlace,
  useMergeEntriesToLocation,
  useMergeTwoSavedLocations,
  useDismissMergeSuggestion,
} from "../modules/locations/mobileLocationHooks";
import { getStateAbbreviation, analyzeLocationIssues, getPlaceIssueKey } from "@trace/core";
import type { Location as LocationType, LocationIssue } from "@trace/core";
import { useLocations } from "../modules/locations/mobileLocationHooks";
import { useNavigate } from "../shared/navigation";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { useTheme, type ThemeContextValue } from "../shared/contexts/ThemeContext";
import { useDrawer } from "../shared/contexts/DrawerContext";
import { ActionSheet, type ActionSheetItem } from "../components/sheets";
import { LocationPicker } from "../modules/locations/components/LocationPicker/LocationPicker";

const log = createScopedLogger(LogScopes.Location);

// ─── Types ──────────────────────────────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getEntryPlaceLabel(place: EntryDerivedPlace): string {
  return place.place_name || place.address || place.city || "Unknown Place";
}

function getEntryPlaceCityLine(place: EntryDerivedPlace): string {
  const isUSA = place.country === "United States" || place.country === "USA" || place.country === "US";
  const isCanada = place.country === "Canada";
  if ((isUSA || isCanada) && place.city && place.region) {
    return `${place.city}, ${getStateAbbreviation(place.region)}`;
  }
  return [place.city, place.country].filter(Boolean).join(", ");
}

function getIssueNotices(issues: LocationIssue[]): string[] {
  return issues
    .filter(issue => issue.type !== 'merge_candidate') // merge handled on manage screen only
    .map(issue => {
      switch (issue.type) {
        case 'snap_candidate':
          return `May be the same as "${issue.targetLocationName}" in My Places`;
        case 'missing_data':
          return `Missing location details (${issue.message.replace('Missing ', '')})`;
        case 'needs_geocoding':
          return issue.message.replace('needs geocoding', 'missing address information')
            .replace('need geocoding', 'missing address information');
        default:
          return issue.message;
      }
    });
}

function entryPlaceMatchesSearch(place: EntryDerivedPlace, query: string): boolean {
  const q = query.toLowerCase();
  return (
    (place.place_name?.toLowerCase().includes(q) ?? false) ||
    (place.address?.toLowerCase().includes(q) ?? false) ||
    (place.city?.toLowerCase().includes(q) ?? false) ||
    (place.region?.toLowerCase().includes(q) ?? false) ||
    (place.country?.toLowerCase().includes(q) ?? false)
  );
}

// ─── Sort ────────────────────────────────────────────────────────────────────────

type LocationSortKey = "name" | "city" | "count" | "distance";

const BASE_SORT_OPTIONS: SortOption<LocationSortKey>[] = [
  { key: "name", label: "Name" },
  { key: "city", label: "City" },
  { key: "count", label: "Count" },
];

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sortPlaces(
  places: EntryDerivedPlace[],
  sortKey: LocationSortKey,
  ascending: boolean,
  userPosition: { lat: number; lng: number } | null,
): EntryDerivedPlace[] {
  const sorted = [...places];
  switch (sortKey) {
    case "name":
      sorted.sort((a, b) => getEntryPlaceLabel(a).localeCompare(getEntryPlaceLabel(b)));
      break;
    case "city":
      sorted.sort((a, b) => (a.city || "").localeCompare(b.city || ""));
      break;
    case "count":
      sorted.sort((a, b) => b.entry_count - a.entry_count);
      break;
    case "distance":
      if (userPosition) {
        sorted.sort((a, b) =>
          getDistanceMeters(userPosition.lat, userPosition.lng, a.avg_latitude, a.avg_longitude) -
          getDistanceMeters(userPosition.lat, userPosition.lng, b.avg_latitude, b.avg_longitude)
        );
      }
      break;
  }
  return ascending ? sorted : sorted.reverse();
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function LocationsScreen() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { setSelectedStreamId, setSelectedStreamName } = useDrawer();

  // Data
  const { data: entryDerivedData, isLoading: entryDerivedLoading } = useEntryDerivedPlaces();
  const { data: savedLocations } = useLocations();
  const entryDerivedPlaces = entryDerivedData || [];

  // Mutations
  const deleteMutation = useDeleteLocation();
  const enrichSingleMutation = useEnrichSingleLocation();
  const promoteMutation = usePromoteEntryPlace();
  const mergeMutation = useMergeEntriesToLocation();
  const mergeSavedMutation = useMergeTwoSavedLocations();
  const dismissMergeMutation = useDismissMergeSuggestion();

  // Snackbar for toast notifications
  const { message: snackbarMessage, opacity: snackbarOpacity, showSnackbar } = useSnackbar();

  // Sort state
  const [sortKey, setSortKey] = useState<LocationSortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch user position for distance sorting
  useEffect(() => {
    (async () => {
      const { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await ExpoLocation.getLastKnownPositionAsync();
        if (loc) setUserPosition({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    })();
  }, []);

  const sortOptions = useMemo(() => {
    if (userPosition) return [...BASE_SORT_OPTIONS, { key: "distance" as const, label: "Distance" }];
    return BASE_SORT_OPTIONS;
  }, [userPosition]);

  const handleSortPress = useCallback((key: LocationSortKey) => {
    if (key === sortKey) {
      setSortAsc(prev => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }, [sortKey]);

  // UI state
  const [searchText, setSearchText] = useState("");
  const [entryPlaceSheet, setEntryPlaceSheet] = useState<EntryDerivedPlace | null>(null);

  // Merge picker state — second sheet for choosing which name wins
  const [mergePicker, setMergePicker] = useState<{
    thisId: string; thisName: string; thisCount: number;
    targetId: string; targetName: string; targetCount: number;
  } | null>(null);

  // Manage picker state — opens LocationPicker in manage mode for a saved place
  const [managePlaceId, setManagePlaceId] = useState<string | null>(null);
  const managePlaceVisible = !!managePlaceId;

  // Filtered + sorted places
  const filteredEntryPlaces = useMemo(() => {
    const filtered = searchText
      ? entryDerivedPlaces.filter(p => entryPlaceMatchesSearch(p, searchText))
      : entryDerivedPlaces;
    return sortPlaces(filtered, sortKey, sortAsc, userPosition);
  }, [entryDerivedPlaces, searchText, sortKey, sortAsc, userPosition]);

  // Issue analysis — per-row data quality indicators
  const issueMap = useMemo(() => {
    if (!entryDerivedPlaces.length) return new Map<string, never[]>();
    // Build lookup for merge_ignore_ids from saved locations
    const ignoreMap = new Map<string, string | null>();
    for (const l of savedLocations || []) {
      ignoreMap.set(l.location_id, l.merge_ignore_ids ?? null);
    }
    return analyzeLocationIssues(
      entryDerivedPlaces.map(p => ({
        place_name: p.place_name,
        address: p.address,
        city: p.city,
        region: p.region,
        country: p.country,
        avg_latitude: p.avg_latitude,
        avg_longitude: p.avg_longitude,
        is_favorite: p.is_favorite,
        location_id: p.location_id,
        ungeocoded_count: p.ungeocoded_count,
        merge_ignore_ids: p.location_id ? ignoreMap.get(p.location_id) ?? null : null,
      })),
      (savedLocations || []).map(l => ({
        location_id: l.location_id,
        name: l.name,
        latitude: l.latitude,
        longitude: l.longitude,
        address: l.address,
        city: l.city,
        region: l.region,
        country: l.country,
      })),
    );
  }, [entryDerivedPlaces, savedLocations]);

  // ─── Manage Picker ─────────────────────────────────────────────────────────

  // Build Location object from saved location data for the picker
  const managePlaceLocation = useMemo((): LocationType | null => {
    if (!managePlaceId || !savedLocations) return null;
    const entity = savedLocations.find(l => l.location_id === managePlaceId);
    if (!entity) return null;
    return {
      location_id: entity.location_id,
      latitude: entity.latitude,
      longitude: entity.longitude,
      name: entity.name,
      source: (entity.source || 'user_custom') as LocationType['source'],
      address: entity.address,
      neighborhood: entity.neighborhood,
      postalCode: entity.postal_code,
      city: entity.city,
      subdivision: entity.subdivision,
      region: entity.region,
      country: entity.country,
    };
  }, [managePlaceId, savedLocations]);

  // Issues for the managed place
  const managePlaceIssues = useMemo((): LocationIssue[] => {
    if (!managePlaceId) return [];
    const place = entryDerivedPlaces.find(p => p.location_id === managePlaceId);
    if (!place) return [];
    return issueMap.get(getPlaceIssueKey(place)) || [];
  }, [managePlaceId, entryDerivedPlaces, issueMap]);

  const handleManageDelete = useCallback(() => {
    if (!managePlaceId) return;
    const place = entryDerivedPlaces.find(p => p.location_id === managePlaceId);
    const placeName = place?.place_name || 'this place';
    const entryMsg = place && place.entry_count > 0
      ? `\n\n${place.entry_count} ${place.entry_count === 1 ? 'entry' : 'entries'} will keep their location data but won't be linked to this saved place.`
      : '';
    Alert.alert(
      'Remove from My Places',
      `Remove "${placeName}" from My Places?${entryMsg}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(managePlaceId);
              setManagePlaceId(null);
            } catch (error) {
              log.error('Failed to delete location', error);
              showSnackbar('Error: Failed to remove place');
            }
          },
        },
      ],
    );
  }, [managePlaceId, entryDerivedPlaces, deleteMutation]);

  const handleManageEnrich = useCallback(async () => {
    if (!managePlaceId) return;
    try {
      const success = await enrichSingleMutation.mutateAsync(managePlaceId);
      if (success) {
        showSnackbar('Place enriched');
      } else {
        showSnackbar('Error: Could not enrich this place');
      }
    } catch (error) {
      log.error('Failed to enrich location', error);
      showSnackbar('Error: Failed to enrich place data');
    }
  }, [managePlaceId, enrichSingleMutation]);

  const handleManageViewEntries = useCallback(() => {
    if (!managePlaceId) return;
    const place = entryDerivedPlaces.find(p => p.location_id === managePlaceId);
    const placeName = place?.place_name || 'Place';
    setManagePlaceId(null);
    setSelectedStreamId(`location:${managePlaceId}`);
    setSelectedStreamName(placeName);
    navigate('inbox');
  }, [managePlaceId, entryDerivedPlaces, navigate, setSelectedStreamId, setSelectedStreamName]);

  const handleManageToggleMyPlace = useCallback(() => {
    // In manage mode for a saved place, toggling removes from My Places
    handleManageDelete();
  }, [handleManageDelete]);

  const handleManageMergeDuplicate = useCallback(() => {
    if (!managePlaceId) return;
    const place = entryDerivedPlaces.find(p => p.location_id === managePlaceId);
    if (!place) return;
    const issues = issueMap.get(getPlaceIssueKey(place)) || [];
    const mergeIssue = issues.find(i => i.type === 'merge_candidate' && i.mergeTargetLocationId);
    if (!mergeIssue?.mergeTargetLocationId || !mergeIssue?.mergeTargetName) return;
    const thisId = managePlaceId;
    const thisName = place.place_name || place.city || 'Place';
    const thisCount = place.entry_count;
    const targetId = mergeIssue.mergeTargetLocationId;
    const targetName = mergeIssue.mergeTargetName;
    const targetPlace = entryDerivedPlaces.find(p => p.location_id === targetId);
    const targetCount = targetPlace?.entry_count ?? 0;
    setManagePlaceId(null); // Close manage picker
    requestAnimationFrame(() => {
      setMergePicker({ thisId, thisName, thisCount, targetId, targetName, targetCount });
    });
  }, [managePlaceId, entryDerivedPlaces, issueMap]);

  const handleManageDismissMerge = useCallback(() => {
    if (!managePlaceId) return;
    const place = entryDerivedPlaces.find(p => p.location_id === managePlaceId);
    if (!place) return;
    const issues = issueMap.get(getPlaceIssueKey(place)) || [];
    const mergeIssue = issues.find(i => i.type === 'merge_candidate' && i.mergeTargetLocationId);
    if (!mergeIssue?.mergeTargetLocationId) return;
    dismissMergeMutation.mutate({
      locationIdA: managePlaceId,
      locationIdB: mergeIssue.mergeTargetLocationId,
    });
    setManagePlaceId(null);
  }, [managePlaceId, entryDerivedPlaces, issueMap, dismissMergeMutation]);

  const openManagePicker = useCallback((locationId: string) => {
    setEntryPlaceSheet(null); // Close action sheet if open
    setManagePlaceId(locationId);
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handlePromotePlace = useCallback(
    async (place: EntryDerivedPlace) => {
      const label = getEntryPlaceLabel(place);
      Alert.alert(
        "Add to My Places",
        `Save "${label}" to My Places? This will create a saved place and link ${place.entry_count} ${place.entry_count === 1 ? "entry" : "entries"} to it.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: async () => {
              try {
                await promoteMutation.mutateAsync(place);
                showSnackbar(`"${label}" added to My Places`);
              } catch (error) {
                log.error("Failed to promote place", error);
                showSnackbar('Error: Failed to save to My Places');
              }
            },
          },
        ],
      );
    },
    [promoteMutation],
  );

  // Action sheet items
  const entryPlaceSheetItems: ActionSheetItem[] = useMemo(() => {
    if (!entryPlaceSheet) return [];
    const items: ActionSheetItem[] = [];
    const isFav = entryPlaceSheet.is_favorite && entryPlaceSheet.location_id;
    const placeName = entryPlaceSheet.place_name || entryPlaceSheet.city || "Place";

    // Edit — favorites only (goes to location properties)
    if (isFav) {
      items.push({
        label: "Edit Place",
        icon: "Edit" as IconName,
        onPress: () => openManagePicker(entryPlaceSheet.location_id!),
      });
    }

    // View Entries — all items with entries > 0
    if (entryPlaceSheet.entry_count > 0) {
      const filterId = isFav && entryPlaceSheet.location_id
        ? `location:${entryPlaceSheet.location_id}`
        : `geo:place:${entryPlaceSheet.place_name || ""}||${entryPlaceSheet.address || ""}||${entryPlaceSheet.city || ""}||${entryPlaceSheet.region || ""}||${entryPlaceSheet.country || ""}`;
      // For unnamed entries, show address or city as the display name
      const displayName = entryPlaceSheet.place_name || entryPlaceSheet.address || entryPlaceSheet.city || "Place";
      items.push({
        label: "View Entries",
        icon: "List" as IconName,
        onPress: () => {
          setSelectedStreamId(filterId);
          setSelectedStreamName(displayName);
          navigate("inbox");
        },
      });
    }

    // Merge with saved location — snap candidates (non-favorites near an existing My Place)
    if (!isFav) {
      const issues = issueMap.get(getPlaceIssueKey(entryPlaceSheet)) || [];
      const snapIssue = issues.find(i => i.type === 'snap_candidate');
      if (snapIssue?.targetLocationId && snapIssue?.targetLocationName) {
        items.push({
          label: `Merge with "${snapIssue.targetLocationName}"`,
          icon: "MapPinFavorite" as IconName,
          onPress: () => {
            const targetName = snapIssue.targetLocationName!;
            const targetId = snapIssue.targetLocationId!;
            const count = entryPlaceSheet.entry_count;
            Alert.alert(
              `Merge with "${targetName}"`,
              `${count} ${count === 1 ? 'entry' : 'entries'} named "${placeName}" will be renamed to "${targetName}" and linked to that saved place.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Merge",
                  onPress: async () => {
                    try {
                      const merged = await mergeMutation.mutateAsync({
                        locationId: targetId,
                        placeMatch: {
                          place_name: entryPlaceSheet.place_name,
                          address: entryPlaceSheet.address,
                          city: entryPlaceSheet.city,
                          region: entryPlaceSheet.region,
                          country: entryPlaceSheet.country,
                        },
                      });
                      showSnackbar(`${merged} ${merged === 1 ? 'entry' : 'entries'} merged with "${targetName}"`);
                    } catch (error) {
                      log.error('Failed to merge entries', error);
                      showSnackbar('Error: Failed to merge entries');
                    }
                  },
                },
              ],
            );
          },
        });
      }
    }

    // Add to My Places — non-favorites only
    if (!isFav) {
      items.push({
        label: "Add to My Places",
        icon: "MapPin" as IconName,
        onPress: () => handlePromotePlace(entryPlaceSheet),
      });
    }

    // Enrich — favorites with missing hierarchy data
    if (isFav && (!entryPlaceSheet.city || !entryPlaceSheet.region || !entryPlaceSheet.country)) {
      items.push({
        label: "Fill in Details",
        icon: "Globe" as IconName,
        onPress: async () => {
          try {
            const success = await enrichSingleMutation.mutateAsync(entryPlaceSheet.location_id!);
            if (success) {
              showSnackbar('Place enriched');
            } else {
              showSnackbar('Error: Could not enrich this place');
            }
          } catch (error) {
            log.error("Failed to enrich location", error);
            showSnackbar('Error: Failed to enrich place data');
          }
        },
      });
    }

    // Remove from My Places — favorites only
    if (isFav) {
      items.push({
        label: "Remove from My Places",
        icon: "Trash2" as IconName,
        onPress: () => {
          const entryMsg = entryPlaceSheet.entry_count > 0
            ? `\n\n${entryPlaceSheet.entry_count} ${entryPlaceSheet.entry_count === 1 ? "entry" : "entries"} will keep their location data but won't be linked to this saved place.`
            : "";
          Alert.alert(
            "Remove from My Places",
            `Remove "${placeName}" from My Places?${entryMsg}`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                style: "destructive",
                onPress: async () => {
                  try {
                    await deleteMutation.mutateAsync(entryPlaceSheet.location_id!);
                  } catch (error) {
                    log.error("Failed to delete location", error);
                    showSnackbar('Error: Failed to delete place');
                  }
                },
              },
            ],
          );
        },
        isDanger: true,
      });
    }

    return items;
  }, [entryPlaceSheet, handlePromotePlace, navigate, enrichSingleMutation, deleteMutation, mergeMutation, issueMap, setSelectedStreamId, setSelectedStreamName]);

  // Merge picker items — second action sheet for choosing which name wins
  const mergePickerItems: ActionSheetItem[] = useMemo(() => {
    if (!mergePicker) return [];
    const { thisId, thisName, thisCount, targetId, targetName, targetCount } = mergePicker;
    const countLabel = (n: number) => n === 1 ? '1 entry' : `${n} entries`;
    const doMerge = async (winnerId: string, loserId: string, winnerName: string) => {
      try {
        const moved = await mergeSavedMutation.mutateAsync({ winnerId, loserId });
        showSnackbar(`${moved} ${moved === 1 ? 'entry' : 'entries'} moved to "${winnerName}"`);
      } catch (error) {
        log.error('Failed to merge saved locations', error);
        showSnackbar('Error: Failed to merge places');
      }
    };
    return [
      { label: `Keep "${thisName}" (${countLabel(thisCount)})`, icon: "MapPin" as IconName, onPress: () => doMerge(thisId, targetId, thisName) },
      { label: `Keep "${targetName}" (${countLabel(targetCount)})`, icon: "MapPin" as IconName, onPress: () => doMerge(targetId, thisId, targetName) },
    ];
  }, [mergePicker, mergeSavedMutation]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Places" />

      {entryDerivedLoading ? (
        <LoadingState message="Loading places..." />
      ) : entryDerivedPlaces.length === 0 && !searchText ? (
        <EmptyState
          icon="MapPin"
          title="No Places Yet"
          subtitle="Add places to your entries to see them here"
        />
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Search */}
          <View style={[styles.searchWrapper, { backgroundColor: theme.colors.background.tertiary }]}>
            <Icon name="Search" size={16} color={theme.colors.text.tertiary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}
              placeholder="Search places..."
              placeholderTextColor={theme.colors.text.tertiary}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="X" size={16} color={theme.colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Sort bar */}
          <SortBar
            options={sortOptions}
            activeKey={sortKey}
            ascending={sortAsc}
            onPress={handleSortPress}
          />

          {filteredEntryPlaces.length === 0 ? (
            <View style={styles.noResultsContainer}>
              <Text style={[styles.noResultsText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                No places match "{searchText}"
              </Text>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              {filteredEntryPlaces.map((place, index) => (
                <EntryPlaceRow
                  key={`${getPlaceIssueKey(place)}-${place.location_id || ''}`}
                  place={place}
                  isLast={index === filteredEntryPlaces.length - 1}
                  theme={theme}
                  issueCount={issueMap.get(getPlaceIssueKey(place))?.length || 0}
                  onMenuPress={() => setEntryPlaceSheet(place)}
                  onPress={() => {
                    if (place.is_favorite && place.location_id) {
                      openManagePicker(place.location_id);
                    } else {
                      setEntryPlaceSheet(place);
                    }
                  }}
                />
              ))}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Action sheet */}
      <ActionSheet
        visible={!!entryPlaceSheet}
        onClose={() => setEntryPlaceSheet(null)}
        items={entryPlaceSheetItems}
        title={entryPlaceSheet ? getEntryPlaceLabel(entryPlaceSheet) : "Actions"}
        notices={entryPlaceSheet
          ? getIssueNotices(issueMap.get(getPlaceIssueKey(entryPlaceSheet)) || [])
          : undefined}
      />

      {/* Merge name picker sheet */}
      <ActionSheet
        visible={!!mergePicker}
        onClose={() => setMergePicker(null)}
        items={mergePickerItems}
        title="Merge Duplicate Places"
        subtitle="Which name do you want to keep?"
      />

      {/* Location Picker — manage mode for editing saved places */}
      <LocationPicker
        visible={managePlaceVisible}
        onClose={() => setManagePlaceId(null)}
        onSelect={() => {}} // No-op in manage mode
        initialLocation={managePlaceLocation}
        mode="manage"
        onDelete={handleManageDelete}
        onEnrich={handleManageEnrich}
        onViewEntries={handleManageViewEntries}
        onToggleMyPlace={handleManageToggleMyPlace}
        onMergeDuplicate={handleManageMergeDuplicate}
        onDismissMerge={handleManageDismissMerge}
        issues={managePlaceIssues}
      />

      <Snackbar message={snackbarMessage} opacity={snackbarOpacity} />
    </View>
  );
}

// ─── EntryPlaceRow ───────────────────────────────────────────────────────────────

interface EntryPlaceRowProps {
  place: EntryDerivedPlace;
  isLast: boolean;
  theme: ThemeContextValue;
  issueCount: number;
  onMenuPress: () => void;
  onPress: () => void;
}

const EntryPlaceRow = memo(function EntryPlaceRow({ place, isLast, theme, issueCount, onMenuPress, onPress }: EntryPlaceRowProps) {
  const cityLine = getEntryPlaceCityLine(place);

  return (
    <View
      style={[
        styles.row,
        !isLast && [styles.rowSeparator, { borderBottomColor: theme.colors.border.light }],
      ]}
    >
      <TouchableOpacity style={styles.rowContent} onPress={onPress} activeOpacity={0.7}>
        <Icon
          name={place.is_favorite ? "MapPinFavoriteLine" : place.place_name ? "MapPin" : "MapPinEmpty"}
          size={16}
          color={place.is_favorite ? theme.colors.functional.accent : theme.colors.text.tertiary}
        />

        <View style={styles.rowTextContainer}>
          {/* Name — blank if no place_name */}
          <Text
            style={[styles.rowName, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}
            numberOfLines={1}
          >
            {place.place_name || ""}
          </Text>
          {place.address && (
            <Text
              style={[styles.rowSubtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}
              numberOfLines={1}
            >
              {place.address}
            </Text>
          )}
          {cityLine ? (
            <Text
              style={[styles.rowSubtitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}
              numberOfLines={1}
            >
              {cityLine}
            </Text>
          ) : null}
        </View>

        {issueCount > 0 && (
          <View style={styles.issueIndicator}>
            <Icon name="AlertCircle" size={14} color={theme.colors.functional.overdue} />
            {issueCount > 1 && (
              <Text style={[styles.issueCountText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>
                {issueCount}
              </Text>
            )}
          </View>
        )}

        {place.entry_count > 0 && (
          <Text style={[styles.entryCount, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            {place.entry_count}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.moreButton} onPress={onMenuPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Icon name="MoreVertical" size={18} color={theme.colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
});

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // List
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 15,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
  },
  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  rowSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTextContainer: {
    flex: 1,
    gap: 1,
  },
  rowName: {
    fontSize: 16,
    flexShrink: 1,
  },
  rowSubtitle: {
    fontSize: 13,
  },
  entryCount: {
    fontSize: 15,
    marginLeft: 4,
  },
  issueIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  issueCountText: {
    fontSize: 11,
  },
  moreButton: {
    padding: 4,
    marginLeft: 4,
  },
  noResultsContainer: {
    padding: 32,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 15,
    textAlign: "center",
  },
  bottomSpacer: {
    height: 20,
  },
});
