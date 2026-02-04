import { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from "react-native";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useLocationsWithCounts } from "../modules/locations/mobileLocationHooks";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { SubBar } from "../components/layout/SubBar";
import { Icon } from "../shared/components";
import { useTheme, type ThemeContextValue } from "../shared/contexts/ThemeContext";
import type { LocationEntity } from "@trace/core";

interface LocationNode {
  name: string;
  level: "country" | "region" | "city" | "neighborhood" | "place";
  entryCount: number;
  children: LocationNode[];
  // Location filter data for navigation
  filter: {
    country?: string;
    region?: string;
    city?: string;
    neighborhood?: string;
    placeName?: string;
  };
  // Location ID for place-level nodes (for navigation to entries)
  locationId?: string;
}

export function LocationsScreen() {
  const theme = useTheme();
  const { navigate } = useNavigation();

  // Use hook for locations with counts instead of direct localDB call
  const { data: locationsData, isLoading } = useLocationsWithCounts();
  const locations = locationsData || [];

  const [searchQuery, setSearchQuery] = useState("");

  // Build location tree from locations
  const locationTree = useMemo(() => {
    const tree: LocationNode[] = [];
    const countryMap = new Map<string, LocationNode>();

    for (const location of locations) {
      const country = location.country || "Unknown Location";
      const region = location.region;
      const subdivision = location.subdivision;
      const city = location.city;
      const neighborhood = location.neighborhood;
      const placeName = location.name;
      const entryCount = location.entry_count || 0;

      // Get or create country node
      let countryNode = countryMap.get(country);
      if (!countryNode) {
        countryNode = {
          name: country,
          level: "country",
          entryCount: 0,
          children: [],
          filter: { country },
        };
        countryMap.set(country, countryNode);
        tree.push(countryNode);
      }
      countryNode.entryCount += entryCount;

      // Build deeper levels
      let currentNode = countryNode;
      let currentFilter: LocationNode["filter"] = { country };

      if (region) {
        currentNode = getOrCreateChild(currentNode, region, "region", {
          ...currentFilter,
          region,
        }, entryCount);
        currentFilter = { ...currentFilter, region };
      }

      // Skip subdivision (county) level - go directly from region to city

      if (city) {
        currentNode = getOrCreateChild(currentNode, city, "city", {
          ...currentFilter,
          city,
        }, entryCount);
        currentFilter = { ...currentFilter, city };
      }

      if (neighborhood) {
        currentNode = getOrCreateChild(currentNode, neighborhood, "neighborhood", {
          ...currentFilter,
          neighborhood,
        }, entryCount);
        currentFilter = { ...currentFilter, neighborhood };
      }

      // Only create place node if placeName is different from the current node's name
      // This avoids redundant nesting like "Coffee Shop > Coffee Shop"
      if (placeName && placeName !== currentNode.name) {
        getOrCreateChild(currentNode, placeName, "place", {
          ...currentFilter,
          placeName,
        }, entryCount, location.location_id);
      } else if (placeName && placeName === currentNode.name) {
        // If the place name matches the current node name, add the location_id to the current node
        currentNode.locationId = location.location_id;
      }
    }

    // Sort tree alphabetically
    sortLocationTree(tree);

    return tree;
  }, [locations]);

  // Filter locations by search
  const filteredTree = useMemo(() => {
    if (!searchQuery) return locationTree;
    return filterLocationTree(locationTree, searchQuery.toLowerCase());
  }, [locationTree, searchQuery]);

  // Count total locations
  const totalLocations = useMemo(() => {
    let count = 0;
    const countNodes = (nodes: LocationNode[]) => {
      for (const node of nodes) {
        count++;
        countNodes(node.children);
      }
    };
    countNodes(locationTree);
    return count;
  }, [locationTree]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Locations" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.text.tertiary} />
          <Text style={[styles.loadingText, { color: theme.colors.text.tertiary }]}>Loading locations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Locations" />

      <SubBar>
        {/* Search Input */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.background.tertiary }]}>
          <Icon name="Search" size={16} color={theme.colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search locations..."
            placeholderTextColor={theme.colors.text.tertiary}
            style={[styles.searchInput, { color: theme.colors.text.primary }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearch}>
              <Icon name="X" size={16} color={theme.colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </SubBar>

      <ScrollView style={[styles.content, { backgroundColor: theme.colors.background.primary }]}>
        {filteredTree.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="MapPin" size={64} color={theme.colors.text.disabled} />
            <Text style={[styles.emptyText, { color: theme.colors.text.tertiary }]}>No locations yet</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.text.tertiary }]}>Add locations to your entries to see them here</Text>
          </View>
        ) : (
          <View style={styles.locationList}>
            {filteredTree.map((node) => (
              <LocationTreeNode
                key={node.name}
                node={node}
                depth={0}
                searchQuery={searchQuery}
                navigate={navigate}
                theme={theme}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Helper function to get or create child node
function getOrCreateChild(
  parent: LocationNode,
  name: string,
  level: LocationNode["level"],
  filter: LocationNode["filter"],
  entryCount: number = 1,
  locationId?: string
): LocationNode {
  let child = parent.children.find((c) => c.name === name);
  if (!child) {
    child = {
      name,
      level,
      entryCount: 0,
      children: [],
      filter,
      locationId,
    };
    parent.children.push(child);
  }
  child.entryCount += entryCount;
  // Update locationId if provided (for place-level nodes)
  if (locationId) {
    child.locationId = locationId;
  }
  return child;
}

// Sort location tree alphabetically
function sortLocationTree(nodes: LocationNode[]) {
  nodes.sort((a, b) => a.name.localeCompare(b.name));
  for (const node of nodes) {
    sortLocationTree(node.children);
  }
}

// Filter location tree by search query
function filterLocationTree(nodes: LocationNode[], query: string): LocationNode[] {
  const result: LocationNode[] = [];

  for (const node of nodes) {
    const matches = node.name.toLowerCase().includes(query);
    const filteredChildren = filterLocationTree(node.children, query);

    if (matches || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren,
      });
    }
  }

  return result;
}

interface LocationTreeNodeProps {
  node: LocationNode;
  depth: number;
  searchQuery: string;
  navigate: (screen: string, params?: any) => void;
  theme: ThemeContextValue;
}

function LocationTreeNode({ node, depth, searchQuery, navigate, theme }: LocationTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const paddingLeft = 16 + depth * 24;

  // Get icon based on level
  const getIcon = () => {
    const iconColor = theme.colors.text.secondary;
    const iconMap: { [key: string]: string } = {
      country: "Globe",
      region: "Building2",
      city: "Building",
      neighborhood: "Home",
      place: "MapPin",
    };
    const iconName = iconMap[node.level] || "MapPin";
    return <Icon name={iconName as any} size={20} color={iconColor} />;
  };

  const handlePress = () => {
    // Only place-level nodes with locationId are navigable
    if (node.locationId) {
      // Navigate to entries filtered by this location
      navigate("inbox", {
        returnStreamId: `location:${node.locationId}`,
        returnStreamName: node.name
      });
    } else if (hasChildren) {
      // Hierarchy nodes just expand/collapse
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.locationNode, { paddingLeft, borderBottomColor: theme.colors.border.light, backgroundColor: theme.colors.background.primary }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* Chevron for expand/collapse */}
        {hasChildren ? (
          <TouchableOpacity
            style={styles.chevronButton}
            onPress={() => setIsExpanded(!isExpanded)}
          >
            <Icon
              name="ChevronRight"
              size={16}
              color={theme.colors.text.secondary}
              style={[styles.chevron, isExpanded && styles.chevronExpanded]}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.chevronButton} />
        )}

        {/* Icon and Name */}
        <View style={styles.locationNameContainer}>
          {getIcon()}
          <Text style={[styles.locationName, { color: theme.colors.text.primary }]}>{node.name}</Text>
        </View>

        {/* Entry count badge */}
        {node.entryCount > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
            <Text style={[styles.badgeText, { color: theme.colors.text.tertiary }]}>{node.entryCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Children */}
      {hasChildren && isExpanded && (
        <View>
          {node.children.map((childNode) => (
            <LocationTreeNode
              key={`${childNode.level}-${childNode.name}`}
              node={childNode}
              depth={depth + 1}
              searchQuery={searchQuery}
              navigate={navigate}
              theme={theme}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  clearSearch: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  locationList: {
    paddingVertical: 8,
  },
  locationNode: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingRight: 16,
    gap: 8,
    borderBottomWidth: 1,
  },
  chevronButton: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  chevron: {
    transform: [{ rotate: "0deg" }],
  },
  chevronExpanded: {
    transform: [{ rotate: "90deg" }],
  },
  locationNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
