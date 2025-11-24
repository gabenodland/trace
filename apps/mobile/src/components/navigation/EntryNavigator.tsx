import React, { useState, useMemo, useEffect, useRef } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useEntries, useTags, useMentions } from "../../modules/entries/mobileEntryHooks";
import { useCategories } from "../../modules/categories/mobileCategoryHooks";
import Svg, { Path, Circle } from "react-native-svg";
import { CategoryTree as CategoryTreeComponent } from "../../modules/categories/components/CategoryTree";
import { TagList } from "../../modules/entries/components/TagList";
import { PeopleList } from "../../modules/entries/components/PeopleList";
import { theme } from "../../shared/theme/theme";
import { getLocationsWithCounts } from "../../modules/locations/mobileLocationApi";
import type { LocationEntity } from "@trace/core";

interface EntryNavigatorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (categoryId: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people", categoryName: string) => void;
  selectedCategoryId: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people";
}

type SegmentType = "categories" | "locations" | "tags" | "mentions";

// Location data structure for display
interface LocationItem {
  name: string;
  entryCount: number;
  locationId: string; // location_id from locations table
}

export function EntryNavigator({ visible, onClose, onSelect, selectedCategoryId }: EntryNavigatorProps) {
  const { categories, categoryTree, isLoading } = useCategories();
  const { tags, isLoading: isLoadingTags } = useTags();
  const { mentions, isLoading: isLoadingMentions } = useMentions();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<SegmentType>("categories");
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
  const { entries: uncategorizedEntries } = useEntries({ category_id: null });
  const uncategorizedCount = uncategorizedEntries.length;
  const { entries: allEntries } = useEntries({});
  const allEntriesCount = allEntries.length;

  // Set correct tab and scroll to selected when modal first opens
  useEffect(() => {
    if (visible) {
      // Determine which tab to show based on selectedCategoryId (only on first open)
      if (typeof selectedCategoryId === 'string') {
        if (selectedCategoryId.startsWith('tag:')) {
          setSelectedSegment('tags');
        } else if (selectedCategoryId.startsWith('mention:')) {
          setSelectedSegment('mentions');
        } else if (selectedCategoryId.startsWith('location:')) {
          setSelectedSegment('locations');
        } else {
          setSelectedSegment('categories');
        }
      } else {
        setSelectedSegment('categories');
      }

      // Scroll to selected item after a brief delay
      setTimeout(() => {
        if (scrollViewRef.current && selectedCategoryId) {
          // Estimate scroll position based on item height (~60px per item)
          const itemHeight = 60;
          let scrollOffset = 0;

          if (selectedSegment === 'categories') {
            // Find index in category tree
            const flatCategories = [{ category_id: 'all' }, { category_id: null }, ...categories];
            const index = flatCategories.findIndex(c => c.category_id === selectedCategoryId);
            if (index >= 0) {
              scrollOffset = index * itemHeight;
            }
          } else if (selectedSegment === 'tags' && typeof selectedCategoryId === 'string' && selectedCategoryId.startsWith('tag:')) {
            const tag = selectedCategoryId.substring(4);
            const index = tags.findIndex(t => t.tag === tag);
            if (index >= 0) {
              scrollOffset = index * itemHeight;
            }
          } else if (selectedSegment === 'mentions' && typeof selectedCategoryId === 'string' && selectedCategoryId.startsWith('mention:')) {
            const mention = selectedCategoryId.substring(8);
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

  // Filter categories, tags, and mentions based on search query
  // When searching, search all types globally (ignore selectedSegment)
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return [];
    return categories.filter((category) =>
      category.display_path.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, searchQuery]);

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

  const handleSelect = (categoryId: string | null, categoryName: string) => {
    onSelect(categoryId, categoryName);
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
              selectedSegment === "categories" && styles.tabActive
            ]}
            onPress={() => {
              setSelectedSegment("categories");
              setSearchQuery("");
            }}
          >
            <Text style={[
              styles.tabText,
              selectedSegment === "categories" && styles.tabTextActive
            ]}>
              Cat
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
            {/* Categories View */}
            {selectedSegment === "categories" && (
              <>
                {/* Home > Uncategorized */}
                <View style={styles.homeContainer}>
                  {/* All - Clickable */}
                  <TouchableOpacity
                    style={[
                      styles.categoryItem,
                      selectedCategoryId === "all" && styles.categoryItemSelected,
                    ]}
                    onPress={() => handleSelect("all", "Home")}
                  >
                    <View style={styles.categoryContent}>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selectedCategoryId === "all" ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                        <Path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={[styles.categoryName, selectedCategoryId === "all" && styles.categoryNameSelected]}>
                        All
                      </Text>
                    </View>
                    {allEntriesCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{allEntriesCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Uncategorized */}
                  <TouchableOpacity
                    style={[
                      styles.categoryItem,
                      selectedCategoryId === null && styles.categoryItemSelected,
                    ]}
                    onPress={() => handleSelect(null, "Uncategorized")}
                  >
                    <View style={styles.categoryContent}>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selectedCategoryId === null ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                        <Path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={[styles.categoryName, selectedCategoryId === null && styles.categoryNameSelected]}>
                        Uncategorized
                      </Text>
                    </View>
                    {uncategorizedCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{uncategorizedCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Category Tree - always expanded */}
                {!isLoading && categoryTree.length > 0 && (
                  <View style={styles.categoryTreeWrapper}>
                    <CategoryTreeComponent
                      tree={categoryTree}
                      onCategoryPress={(categoryId) => {
                        const category = categories.find((c) => c.category_id === categoryId);
                        handleSelect(categoryId, category?.name || "Unknown");
                      }}
                      selectedId={
                        selectedCategoryId === null ||
                        selectedCategoryId === "all" ||
                        selectedCategoryId === "tasks" ||
                        selectedCategoryId === "events" ||
                        selectedCategoryId === "categories" ||
                        selectedCategoryId === "tags" ||
                        selectedCategoryId === "people"
                          ? null
                          : selectedCategoryId
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
                      const isSelected = selectedCategoryId === locationFilterId;
                      return (
                        <TouchableOpacity
                          key={location.locationId}
                          style={[
                            styles.categoryItem,
                            isSelected && styles.categoryItemSelected,
                          ]}
                          onPress={() => handleSelect(locationFilterId, location.name)}
                        >
                          <View style={styles.categoryContent}>
                            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={isSelected ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                              <Circle cx={12} cy={10} r={3} />
                            </Svg>
                            <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>
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
                        typeof selectedCategoryId === 'string' && selectedCategoryId.startsWith('tag:')
                          ? selectedCategoryId.substring(4)
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
                        typeof selectedCategoryId === 'string' && selectedCategoryId.startsWith('mention:')
                          ? selectedCategoryId.substring(8)
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
            {/* Global Search Results - All categories, tags, and mentions together */}

            {/* Categories */}
            {filteredCategories.map((category) => (
              <TouchableOpacity
                key={category.category_id}
                style={[
                  styles.categoryItem,
                  selectedCategoryId === category.category_id && styles.categoryItemSelected,
                ]}
                onPress={() => handleSelect(category.category_id, category.name)}
              >
                <View style={styles.categoryContent}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={selectedCategoryId === category.category_id ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                    <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <View style={styles.categoryTextContainer}>
                    <Text style={[styles.categoryPath, selectedCategoryId === category.category_id && styles.categoryPathSelected]}>
                      {category.display_path}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {/* Locations */}
            {filteredLocations.map((location) => {
              const locationFilterId = `location:${location.locationId}`;
              const isSelected = selectedCategoryId === locationFilterId;
              return (
                <TouchableOpacity
                  key={location.locationId}
                  style={[
                    styles.categoryItem,
                    isSelected && styles.categoryItemSelected,
                  ]}
                  onPress={() => handleSelect(locationFilterId, location.name)}
                >
                  <View style={styles.categoryContent}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={isSelected ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                      <Circle cx={12} cy={10} r={3} />
                    </Svg>
                    <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>
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
              const isSelected = selectedCategoryId === tagId;
              return (
                <TouchableOpacity
                  key={tagId}
                  style={[
                    styles.categoryItem,
                    isSelected && styles.categoryItemSelected,
                  ]}
                  onPress={() => handleSelect(tagId, `#${tag.tag}`)}
                >
                  <View style={styles.categoryContent}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={isSelected ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                      <Path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>
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
              const isSelected = selectedCategoryId === mentionId;
              return (
                <TouchableOpacity
                  key={mentionId}
                  style={[
                    styles.categoryItem,
                    isSelected && styles.categoryItemSelected,
                  ]}
                  onPress={() => handleSelect(mentionId, `@${mention.mention}`)}
                >
                  <View style={styles.categoryContent}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={isSelected ? theme.colors.text.primary : theme.colors.text.tertiary} strokeWidth={2}>
                      <Path d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>
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
            {filteredCategories.length === 0 && filteredLocations.length === 0 && filteredTags.length === 0 && filteredMentions.length === 0 && (
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
  homeTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  homeTitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.tertiary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  indentSpacer: {
    width: 20,
  },
  categoryTreeWrapper: {
    paddingLeft: 20,
  },
  listWrapper: {
    paddingTop: theme.spacing.sm,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  categoryItemSelected: {
    backgroundColor: theme.colors.background.tertiary,
  },
  categoryContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flex: 1,
  },
  categoryTextContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  categoryNameSelected: {
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
  categoryPath: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  categoryPathSelected: {
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
