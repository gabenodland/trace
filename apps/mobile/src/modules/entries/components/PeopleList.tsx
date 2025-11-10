import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Path } from "react-native-svg";

interface PeopleListProps {
  people: Array<{ mention: string; count: number }>;
  onPersonPress?: (mention: string) => void;
  selectedPerson?: string | null;
}

export function PeopleList({ people, onPersonPress, selectedPerson }: PeopleListProps) {
  if (people.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No people yet</Text>
        <Text style={styles.emptySubtext}>Use @mentions in your entries to reference people</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {people.map((item) => {
        const isSelected = selectedPerson === item.mention;

        return (
          <TouchableOpacity
            key={item.mention}
            style={[
              styles.personItem,
              isSelected && styles.personItemSelected,
            ]}
            onPress={() => onPersonPress?.(item.mention)}
          >
            <View style={styles.personContent}>
              {/* Person Icon */}
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#2563eb" : "#6b7280"} strokeWidth={2}>
                <Path d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>

              {/* Person name with @ prefix */}
              <Text style={[styles.personName, isSelected && styles.personNameSelected]}>
                @{item.mention}
              </Text>
            </View>

            {/* Entry count badge */}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.count}</Text>
            </View>

            {/* Divider */}
            <View style={styles.personItemDivider} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  personItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingLeft: 20, // Indent people inside section
  },
  personItemSelected: {
    backgroundColor: "#dbeafe",
  },
  personItemDivider: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 28,
    height: 1,
    backgroundColor: "#f3f4f6",
  },
  personContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  personName: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
    flex: 1,
  },
  personNameSelected: {
    color: "#1e40af",
    fontWeight: "600",
  },
  badge: {
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 32,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
});
