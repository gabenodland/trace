import { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from "react-native";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { useLocationsWithCounts } from "../modules/locations/mobileLocationHooks";
import { TopBar } from "../components/layout/TopBar";
import { SubBar } from "../components/layout/SubBar";
import Svg, { Path, Circle } from "react-native-svg";
import { theme } from "../shared/theme/theme";
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
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();

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
      <View style={styles.container}>
        <TopBar
          title="Locations"
          menuItems={menuItems}
          userEmail={userEmail}
          onProfilePress={onProfilePress}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.text.tertiary} />
          <Text style={styles.loadingText}>Loading locations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar
        title="Locations"
        badge={totalLocations}
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

      <SubBar>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} style={styles.searchIcon}>
            <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search locations..."
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearch}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
                <Path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}
        </View>
      </SubBar>

      <ScrollView style={styles.content}>
        {filteredTree.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth={1.5}>
              <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.emptyText}>No locations yet</Text>
            <Text style={styles.emptySubtext}>Add locations to your entries to see them here</Text>
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
}

function LocationTreeNode({ node, depth, searchQuery, navigate }: LocationTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const paddingLeft = 16 + depth * 24;

  // Get icon based on level
  const getIcon = () => {
    switch (node.level) {
      case "country":
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
            <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case "region":
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
            <Path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.85M19 21V10.85M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case "city":
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
            <Path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case "neighborhood":
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
            <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
      case "place":
      default:
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
            <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );
    }
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
        style={[styles.locationNode, { paddingLeft }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* Chevron for expand/collapse */}
        {hasChildren ? (
          <TouchableOpacity
            style={styles.chevronButton}
            onPress={() => setIsExpanded(!isExpanded)}
          >
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6b7280"
              strokeWidth={2}
              style={[styles.chevron, isExpanded && styles.chevronExpanded]}
            >
              <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        ) : (
          <View style={styles.chevronButton} />
        )}

        {/* Icon and Name */}
        <View style={styles.locationNameContainer}>
          {getIcon()}
          <Text style={styles.locationName}>{node.name}</Text>
        </View>

        {/* Entry count badge */}
        {node.entryCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{node.entryCount}</Text>
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
    backgroundColor: theme.colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.text.tertiary,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: theme.spacing.md,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text.primary,
    padding: 0,
  },
  clearSearch: {
    padding: 4,
  },
  content: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
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
    color: "#9ca3af",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
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
    borderBottomColor: theme.colors.border.light,
    backgroundColor: theme.colors.background.primary,
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
    color: theme.colors.text.primary,
    fontWeight: "500",
  },
  badge: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text.tertiary,
  },
});
