import React, { useState, useMemo, useEffect, useRef } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useEntries, useTags, useMentions } from "../../modules/entries/mobileEntryHooks";
import { useStreams } from "../../modules/streams/mobileStreamHooks";
import Svg, { Path, Circle } from "react-native-svg";
import { StreamList } from "../../modules/streams/components/StreamList";
import { TagList } from "../../modules/entries/components/TagList";
import { PeopleList } from "../../modules/entries/components/PeopleList";
import { theme } from "../../shared/theme/theme";
import { getLocationsWithCounts } from "../../modules/locations/mobileLocationApi";
import type { LocationEntity } from "@trace/core";

interface EntryNavigatorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (streamId: string | null | "all" | "events" | "streams" | "tags" | "people", streamName: string) => void;
  selectedStreamId: string | null | "all" | "events" | "streams" | "tags" | "people";
}

type SegmentType = "streams" | "locations" | "tags" | "mentions";

// Location data structure for display
interface LocationItem {
  name: string;
  entryCount: number;
  locationId: string; // location_id from locations table
}

export function EntryNavigator({ visible, onClose, onSelect, selectedStreamId }: EntryNavigatorProps) {
  const { streams, isLoading } = useStreams();
  const { tags, isLoading: isLoadingTags } = useTags();
  const { mentions, isLoading: isLoadingMentions } = useMentions();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<SegmentType>("streams");
  const scrollViewRef = useRef<ScrollView>(null);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  // Load locations from locations table when locations tab is selected
  useEffect(() => {
    if (visible && selectedSegment === "locations") {
      const loadLocations = async () => {
        setIsLoadingLocations(true);
        try {
          const locationsWithCounts = await getLocationsWithCounts();
          const locationItems: LocationItem[] = locationsWithCounts.map(loc => ({
            name: loc.name,
            entryCount: loc.entry_count,
            locationId: loc.location_id,
          }));
          // Sort by entry count (descending), then by name
          locationItems.sort((a, b) => {
            if (b.entryCount !== a.entryCount) {
              return b.entryCount - a.entryCount;
            }
            return a.name.localeCompare(b.name);
          });
          setLocations(locationItems);
        } catch (error) {
          console.error("Error loading locations:", error);
        } finally {
          setIsLoadingLocations(false);
        }
      };
      loadLocations();
    }
  }, [visible, selectedSegment]);

  // Filter locations by search
  const filteredLocations = useMemo(() => {
    if (!searchQuery) return [];
    return locations.filter((loc) =>
      loc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [locations, searchQuery]);

  // Get entry counts
  const { entries: noStreamEntries } = useEntries({ stream_id: null });
  const noStreamCount = noStreamEntries.length;
  const { entries: allEntries } = useEntries({});
  const allEntriesCount = allEntries.length;

  // Set correct tab and scroll to selected when modal first opens
  useEffect(() => {
    if (visible) {
      // Determine which tab to show based on selectedStreamId (only on first open)
      if (typeof selectedStreamId === 'string') {
        if (selectedStreamId.startsWith('tag:')) {
          setSelectedSegment('tags');
        } else if (selectedStreamId.startsWith('mention:')) {
          setSelectedSegment('mentions');
        } else if (selectedStreamId.startsWith('location:')) {
          setSelectedSegment('locations');
        } else {
          setSelectedSegment('streams');
        }
      } else {
        setSelectedSegment('streams');
      }

      // Scroll to selected item after a brief delay
      setTimeout(() => {
        if (scrollViewRef.current && selectedStreamId) {
          // Estimate scroll position based on item height (~60px per item)
          const itemHeight = 60;
          let scrollOffset = 0;

          if (selectedSegment === 'streams') {
            // Find index in stream list
            const flatStreams = [{ stream_id: 'all' }, { stream_id: null }, ...streams];
            const index = flatStreams.findIndex(s => s.stream_id === selectedStreamId);
            if (index >= 0) {
              scrollOffset = index * itemHeight;
            }
          } else if (selectedSegment === 'tags' && typeof selectedStreamId === 'string' && selectedStreamId.startsWith('tag:')) {
            const tag = selectedStreamId.substring(4);
            const index = tags.findIndex(t => t.tag === tag);
            if (index >= 0) {
              scrollOffset = index * itemHeight;
            }
          } else if (selectedSegment === 'mentions' && typeof selectedStreamId === 'string' && selectedStreamId.startsWith('mention:')) {
            const mention = selectedStreamId.substring(8);
            const index = mentions.findIndex(m => m.mention === mention);
            if (index >= 0) {
              scrollOffset = index * itemHeight;
            }
          }

          scrollViewRef.current.scrollTo({ y: scrollOffset, animated: true });
        }
      }, 100);
    }
  }, [visible]); // Only run when visible changes

  // Filter streams based on search query
  const filteredStreams = useMemo(() => {
    if (!searchQuery) return [];
    return streams.filter((stream) =>
      stream.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [streams, searchQuery]);

  // Filter tags - match tag name or #tag format
  const filteredTags = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    // Remove # if user types it
    const cleanQuery = query.startsWith('#') ? query.slice(1) : query;
    return tags.filter((tag) =>
      tag.tag.toLowerCase().includes(cleanQuery)
    );
  }, [tags, searchQuery]);

  // Filter mentions - match mention name or @mention format
  const filteredMentions = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    // Remove @ if user types it
    const cleanQuery = query.startsWith('@') ? query.slice(1) : query;
    return mentions.filter((mention) =>
      mention.mention.toLowerCase().includes(cleanQuery)
    );
  }, [mentions, searchQuery]);

  const handleSelect = (streamId: string | null, streamName: string) => {
    onSelect(streamId, streamName);
    setSearchQuery("");
    onClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} style={styles.searchIcon}>
          <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search all..."
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearch}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
              <Path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Bar - Hide when searching */}
      {!searchQuery && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              selectedSegment === "streams" && styles.tabActive
            ]}
            onPress={() => {
              setSelectedSegment("streams");
              setSearchQuery("");
            }}
          >
            <Text style={[
              styles.tabText,
              selectedSegment === "streams" && styles.tabTextActive
            ]}>
              Stream
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedSegment === "locations" && styles.tabActive
            ]}
            onPress={() => {
              setSelectedSegment("locations");
              setSearchQuery("");
            }}
          >
            <Text style={[
              styles.tabText,
              selectedSegment === "locations" && styles.tabTextActive
            ]}>
              Loc
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedSegment === "tags" && styles.tabActive
            ]}
            onPress={() => {
              setSelectedSegment("tags");
              setSearchQuery("");
            }}
          >
            <Text style={[
              styles.tabText,
              selectedSegment === "tags" && styles.tabTextActive
            ]}>
              Tag
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedSegment === "mentions" && styles.tabActive
            ]}
            onPress={() => {
              setSelectedSegment("mentions");
              setSearchQuery("");
            }}
          >
            <Text style={[
              styles.tabText,
              selectedSegment === "mentions" && styles.tabTextActive
            ]}>
              @
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        bounces={false}
      >
        {searchQuery === "" ? (
          <>
            {/* Streams View */}
            {selectedSegment === "streams" && (
              <>
                {/* Home > Unassigned */}
                <View style={styles.homeContainer}>
                  {/* All Entries - Clickable */}
                  <TouchableOpacity
                    style={[
                      styles.streamItem,
                      selectedStreamId === "all" && styles.streamItemSelected,
                    ]}
                    onPress={() => handleSelect("all", "All Entries")}
                  >
                    <View style={styles.streamContent}>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selectedStreamId === "all" ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                        <Path d="M22 12h-6l-2 3h-4l-2-3H2" strokeLinecap="round" strokeLinejoin="round" />
                        <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={[styles.streamName, selectedStreamId === "all" && styles.streamNameSelected]}>
                        All Entries
                      </Text>
                    </View>
                    {allEntriesCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{allEntriesCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Unassigned */}
                  <TouchableOpacity
                    style={[
                      styles.streamItem,
                      selectedStreamId === null && styles.streamItemSelected,
                    ]}
                    onPress={() => handleSelect(null, "Unassigned")}
                  >
                    <View style={styles.streamContent}>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selectedStreamId === null ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={1.5}>
                        <Path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
                        <Path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
                        <Path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
                      </Svg>
                      <Text style={[styles.streamName, selectedStreamId === null && styles.streamNameSelected]}>
                        Unassigned
                      </Text>
                    </View>
                    {noStreamCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{noStreamCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Stream List - flat list */}
                {!isLoading && streams.length > 0 && (
                  <View style={styles.streamListWrapper}>
                    <StreamList
                      streams={streams}
                      onStreamPress={(streamId) => {
                        const stream = streams.find((s) => s.stream_id === streamId);
                        handleSelect(streamId, stream?.name || "Unknown");
                      }}
                      selectedId={
                        selectedStreamId === null ||
                        selectedStreamId === "all" ||
                        selectedStreamId === "events" ||
                        selectedStreamId === "streams" ||
                        selectedStreamId === "tags" ||
                        selectedStreamId === "people"
                          ? null
                          : selectedStreamId
                      }
                    />
                  </View>
                )}
              </>
            )}

            {/* Locations View */}
            {selectedSegment === "locations" && (
              <>
                {!isLoadingLocations && locations.length > 0 ? (
                  <View style={styles.listWrapper}>
                    {locations.map((location) => {
                      const locationFilterId = `location:${location.locationId}`;
                      const isSelected = selectedStreamId === locationFilterId;
                      return (
                        <TouchableOpacity
                          key={location.locationId}
                          style={[
                            styles.streamItem,
                            isSelected && styles.streamItemSelected,
                          ]}
                          onPress={() => handleSelect(locationFilterId, location.name)}
                        >
                          <View style={styles.streamContent}>
                            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={isSelected ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                              <Circle cx={12} cy={10} r={3} />
                            </Svg>
                            <Text style={[styles.streamName, isSelected && styles.streamNameSelected]}>
                              {location.name}
                            </Text>
                          </View>
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{location.entryCount}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : isLoadingLocations ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Loading locations...</Text>
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No locations yet</Text>
                    <Text style={styles.emptySubtext}>Locations will appear when you add locations to your entries</Text>
                  </View>
                )}
              </>
            )}

            {/* Tags View */}
            {selectedSegment === "tags" && (
              <>
                {!isLoadingTags && tags.length > 0 ? (
                  <View style={styles.listWrapper}>
                    <TagList
                      tags={tags}
                      onTagPress={(tag) => {
                        handleSelect(`tag:${tag}`, `#${tag}`);
                      }}
                      selectedTag={
                        typeof selectedStreamId === 'string' && selectedStreamId.startsWith('tag:')
                          ? selectedStreamId.substring(4)
                          : null
                      }
                    />
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No tags yet</Text>
                    <Text style={styles.emptySubtext}>Tags will appear when you use #hashtags in your entries</Text>
                  </View>
                )}
              </>
            )}

            {/* Mentions View */}
            {selectedSegment === "mentions" && (
              <>
                {!isLoadingMentions && mentions.length > 0 ? (
                  <View style={styles.listWrapper}>
                    <PeopleList
                      people={mentions}
                      onPersonPress={(mention) => {
                        handleSelect(`mention:${mention}`, `@${mention}`);
                      }}
                      selectedPerson={
                        typeof selectedStreamId === 'string' && selectedStreamId.startsWith('mention:')
                          ? selectedStreamId.substring(8)
                          : null
                      }
                    />
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No mentions yet</Text>
                    <Text style={styles.emptySubtext}>Mentions will appear when you use @mentions in your entries</Text>
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Global Search Results - All streams, tags, and mentions together */}

            {/* Streams */}
            {filteredStreams.map((stream) => (
              <TouchableOpacity
                key={stream.stream_id}
                style={[
                  styles.streamItem,
                  selectedStreamId === stream.stream_id && styles.streamItemSelected,
                ]}
                onPress={() => handleSelect(stream.stream_id, stream.name)}
              >
                <View style={styles.streamContent}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selectedStreamId === stream.stream_id ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                    <Path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <View style={styles.streamTextContainer}>
                    <Text style={[styles.streamPath, selectedStreamId === stream.stream_id && styles.streamPathSelected]}>
                      {stream.name}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {/* Locations */}
            {filteredLocations.map((location) => {
              const locationFilterId = `location:${location.locationId}`;
              const isSelected = selectedStreamId === locationFilterId;
              return (
                <TouchableOpacity
                  key={location.locationId}
                  style={[
                    styles.streamItem,
                    isSelected && styles.streamItemSelected,
                  ]}
                  onPress={() => handleSelect(locationFilterId, location.name)}
                >
                  <View style={styles.streamContent}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={isSelected ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                      <Circle cx={12} cy={10} r={3} />
                    </Svg>
                    <Text style={[styles.streamName, isSelected && styles.streamNameSelected]}>
                      {location.name}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{location.entryCount}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Tags */}
            {filteredTags.map((tag) => {
              const tagId = `tag:${tag.tag}`;
              const isSelected = selectedStreamId === tagId;
              return (
                <TouchableOpacity
                  key={tagId}
                  style={[
                    styles.streamItem,
                    isSelected && styles.streamItemSelected,
                  ]}
                  onPress={() => handleSelect(tagId, `#${tag.tag}`)}
                >
                  <View style={styles.streamContent}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={isSelected ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                      <Path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={[styles.streamName, isSelected && styles.streamNameSelected]}>
                      #{tag.tag}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{tag.count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Mentions */}
            {filteredMentions.map((mention) => {
              const mentionId = `mention:${mention.mention}`;
              const isSelected = selectedStreamId === mentionId;
              return (
                <TouchableOpacity
                  key={mentionId}
                  style={[
                    styles.streamItem,
                    isSelected && styles.streamItemSelected,
                  ]}
                  onPress={() => handleSelect(mentionId, `@${mention.mention}`)}
                >
                  <View style={styles.streamContent}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={isSelected ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                      <Path d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={[styles.streamName, isSelected && styles.streamNameSelected]}>
                      @{mention.mention}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{mention.count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* No results */}
            {filteredStreams.length === 0 && filteredLocations.length === 0 && filteredTags.length === 0 && filteredMentions.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    height: '100%',
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
    flexShrink: 0,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    padding: 0,
  },
  clearSearch: {
    padding: theme.spacing.xs,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#3b82f6",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  tabTextActive: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    flexShrink: 1,
  },
  contentContainer: {
    paddingBottom: theme.spacing.sm,
  },
  homeContainer: {
    paddingTop: theme.spacing.sm,
  },
  streamListWrapper: {
    paddingLeft: 0,
  },
  listWrapper: {
    paddingTop: theme.spacing.sm,
  },
  streamItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  streamItemSelected: {
    backgroundColor: theme.colors.background.tertiary,
  },
  streamContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flex: 1,
  },
  streamTextContainer: {
    flex: 1,
  },
  streamName: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  streamNameSelected: {
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  badge: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.tertiary,
  },
  streamPath: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  streamPathSelected: {
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  emptyContainer: {
    padding: theme.spacing.xxxl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing.xs,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.tertiary,
    textAlign: "center",
  },
});
