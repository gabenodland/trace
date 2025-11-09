import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { CategoryTree as CategoryTreeType } from "@trace/core";
import Svg, { Path } from "react-native-svg";

interface CategoryTreeProps {
  tree: CategoryTreeType[];
  onCategoryPress?: (categoryId: string) => void;
  selectedId?: string | null;
}

export function CategoryTree({ tree, onCategoryPress, selectedId }: CategoryTreeProps) {
  if (tree.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No categories yet</Text>
        <Text style={styles.emptySubtext}>Create your first category to get started</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {tree.map((node) => (
        <CategoryNode
          key={node.category.category_id}
          node={node}
          depth={0}
          onPress={onCategoryPress}
          selectedId={selectedId}
        />
      ))}
    </View>
  );
}

interface CategoryNodeProps {
  node: CategoryTreeType;
  depth: number;
  onPress?: (categoryId: string) => void;
  selectedId?: string | null;
}

function CategoryNode({ node, depth, onPress, selectedId }: CategoryNodeProps) {
  const isSelected = selectedId === node.category.category_id;
  const hasChildren = node.children.length > 0;
  const paddingLeft = 16 + depth * 20;

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.nodeContainer,
          { paddingLeft },
          isSelected && styles.nodeContainerSelected,
        ]}
        onPress={() => onPress?.(node.category.category_id)}
      >
        <View style={styles.nodeContent}>
          {hasChildren && (
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2} style={styles.chevron}>
              <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
            <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.nodeName, isSelected && styles.nodeNameSelected]}>
            {node.category.name}
          </Text>
          {node.entry_count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{node.entry_count}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {hasChildren && (
        <View>
          {node.children.map((childNode) => (
            <CategoryNode
              key={childNode.category.category_id}
              node={childNode}
              depth={depth + 1}
              onPress={onPress}
              selectedId={selectedId}
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  nodeContainer: {
    paddingVertical: 12,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  nodeContainerSelected: {
    backgroundColor: "#dbeafe",
  },
  nodeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chevron: {
    marginRight: 4,
  },
  nodeName: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
    flex: 1,
  },
  nodeNameSelected: {
    color: "#1e40af",
    fontWeight: "600",
  },
  badge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },
});
