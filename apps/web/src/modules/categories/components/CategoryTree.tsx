import { CategoryTree as CategoryTreeType } from "@trace/core";

interface CategoryTreeProps {
  tree: CategoryTreeType[];
  onCategoryPress?: (categoryId: string) => void;
  selectedId?: string | null;
}

export function CategoryTree({ tree, onCategoryPress, selectedId }: CategoryTreeProps) {
  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <p className="text-lg font-semibold mb-2">No categories yet</p>
        <p className="text-sm">Create your first category to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tree.map((node) => (
        <CategoryNode
          key={node.category.category_id}
          node={node}
          depth={0}
          onPress={onCategoryPress}
          selectedId={selectedId}
        />
      ))}
    </div>
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
  const paddingLeft = depth * 24;

  return (
    <div>
      <button
        onClick={() => onPress?.(node.category.category_id)}
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
        className={`w-full flex items-center gap-2 py-3 px-4 rounded-lg transition-colors ${
          isSelected
            ? "bg-blue-50 text-blue-700 font-semibold"
            : "hover:bg-gray-50 text-gray-700"
        }`}
      >
        {hasChildren && (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <span className="flex-1 text-left">{node.category.name}</span>
        {node.entry_count > 0 && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-gray-200 text-gray-600 rounded-full">
            {node.entry_count}
          </span>
        )}
      </button>

      {hasChildren && (
        <div className="mt-1">
          {node.children.map((childNode) => (
            <CategoryNode
              key={childNode.category.category_id}
              node={childNode}
              depth={depth + 1}
              onPress={onPress}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
