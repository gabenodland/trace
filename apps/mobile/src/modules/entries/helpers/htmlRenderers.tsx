/**
 * Custom renderers for react-native-render-html
 *
 * Handles TipTap-specific HTML structures:
 * - Task lists with styled checkbox Views (matching editor appearance)
 * - Tables with measured column widths (two-phase render) + horizontal scroll
 * - Regular lists delegated to InternalRenderer for bullet/number markers
 *
 * All renderer components are module-scope stable references.
 * They receive theme via useTheme() hook, not closure variables.
 */
import React, { useState, useRef, useCallback, useEffect, useMemo, useContext, createContext } from 'react';
import { View, ScrollView, useWindowDimensions, StyleSheet, Text } from 'react-native';
import type {
  CustomRendererProps,
  TBlock,
  TNode,
  CustomTagRendererRecord,
} from 'react-native-render-html';
import { TNodeChildrenRenderer } from 'react-native-render-html';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { HTML_CONTENT_HORIZONTAL_PADDING } from './htmlRenderConfig';

// ---------------------------------------------------------------------------
// Native table touch flag — prevents drawer gesture from stealing horizontal
// swipes when the user is touching a table ScrollView in the entry list.
// Same pattern as isTableTouched in useSwipeBackGesture (for editor WebView).
// ---------------------------------------------------------------------------

let _isNativeTableTouched = false;

/** Check if user is currently touching a native RNRH table */
export function getIsNativeTableTouched(): boolean {
  return _isNativeTableTouched;
}

// Stable handlers for table wrapper touch events (module scope — no closures)
const setNativeTableTouched = () => { _isNativeTableTouched = true; };
const clearNativeTableTouched = () => { _isNativeTableTouched = false; };

// ---------------------------------------------------------------------------
// Entry press context — allows table renderer to propagate taps to the entry.
// The table's inner View claims onStartShouldSetResponder (for scroll), which
// prevents the parent TouchableOpacity from receiving taps. This context lets
// the table detect taps (via onResponderRelease) and forward them.
// ---------------------------------------------------------------------------

export const HtmlContentPressContext = createContext<(() => void) | null>(null);

// ---------------------------------------------------------------------------
// Task List Renderer (<ul data-type="taskList">)
// ---------------------------------------------------------------------------

/**
 * TipTap emits: <ul data-type="taskList"><li data-type="taskItem" data-checked="true">...
 * We use TDefaultRenderer (no bullet markers) and let LiRenderer handle each item.
 */
function TaskListRenderer(props: CustomRendererProps<TBlock>) {
  const { TDefaultRenderer, tnode, ...rest } = props;
  return (
    <TDefaultRenderer
      tnode={tnode}
      {...rest}
      style={[props.style, styles.taskList]}
    />
  );
}

// ---------------------------------------------------------------------------
// Task Item Renderer (<li data-type="taskItem">)
// ---------------------------------------------------------------------------

/**
 * Renders a checkbox View + text content for each task item.
 * Checkbox appearance matches the editor's WebView rendering:
 * - Unchecked: 18x18 rounded square, 1.5px border, border.dark color
 * - Checked: 18x18 rounded square, accent color fill, white ✓
 * - Checked items: text at 0.6 opacity
 */
function TaskItemRenderer(props: CustomRendererProps<TBlock>) {
  const { tnode } = props;
  const theme = useTheme();
  const isChecked = tnode.attributes['data-checked'] === 'true';
  const accentColor = theme.colors.functional.accent;
  const borderColor = theme.colors.border.dark;

  return (
    <View style={[styles.taskItem, isChecked && styles.taskItemChecked]}>
      <View
        style={[
          styles.checkbox,
          isChecked
            ? { borderColor: accentColor, backgroundColor: accentColor }
            : { borderColor },
        ]}
      >
        {isChecked && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </View>
      <View style={styles.taskItemContent}>
        <TNodeChildrenRenderer
          tnode={tnode}
          renderChild={({ childElement, childTnode }) => {
            // Skip label and input — we render the checkbox ourselves
            const tag = childTnode.tagName;
            if (tag === 'label' || tag === 'input') {
              return null;
            }
            return childElement;
          }}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

// Minimum column width — floor for empty cells or very short content
const MIN_COL_WIDTH = 40;

/**
 * Walk the table tnode tree and extract rows with their cells.
 *
 * TipTap structure: table > tbody > tr > th/td
 * - All rows live in <tbody> (never <thead>)
 * - <th> marks header cells (column headers, row headers, or both)
 * - <td> marks regular body cells
 */
function extractTableRows(tnode: TNode): { cells: TNode[] }[] {
  const rows: { cells: TNode[] }[] = [];

  for (const child of tnode.children) {
    const tag = child.tagName;
    if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') {
      for (const row of child.children) {
        if (row.tagName === 'tr') {
          const cells = row.children.filter(
            (c: TNode) => c.tagName === 'th' || c.tagName === 'td'
          );
          rows.push({ cells });
        }
      }
    } else if (tag === 'tr') {
      const cells = child.children.filter(
        (c: TNode) => c.tagName === 'th' || c.tagName === 'td'
      );
      rows.push({ cells });
    }
  }

  return rows;
}

/** Read the colspan attribute from a cell tnode, defaulting to 1. */
function getCellColspan(cell: TNode): number {
  const attr = cell.attributes?.colspan;
  if (!attr) return 1;
  const n = parseInt(attr, 10);
  return isNaN(n) || n < 1 ? 1 : n;
}

// ---------------------------------------------------------------------------
// Table Renderer (<table>)
// ---------------------------------------------------------------------------

/**
 * Two-phase table renderer with actual measured column widths.
 *
 * Phase 1 (measuring): Renders all cells in a hidden absolute-positioned
 * container with no width constraint. Each cell sizes to its natural content
 * width. onLayout callbacks collect the actual pixel width of each cell.
 * The max width per column across all rows determines column widths.
 *
 * Phase 2 (layout): Renders the real table with the measured column widths
 * applied uniformly across all rows. If the total is less than the screen
 * width, columns are scaled up proportionally to fill.
 *
 * This approach:
 * - Uses the actual layout engine — no font/character-width guessing
 * - Works correctly with any font, size, weight, or content
 * - Respects <p> and <br> line breaks (measured width = widest line)
 * - Handles column headers, row headers, or both (per-cell th highlighting)
 * - Horizontal ScrollView activates when table exceeds screen width
 * - colspan cells distribute their width across spanned columns
 */
function TableRenderer(props: CustomRendererProps<TBlock>) {
  const { tnode } = props;
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const onEntryPress = useContext(HtmlContentPressContext);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const contentWidth = windowWidth - HTML_CONTENT_HORIZONTAL_PADDING;
  const borderColor = theme.colors.border.dark;
  const headerBg = theme.colors.background.tertiary;

  // Compute rows, numColumns (accounting for colspan), and totalCells in one memo
  const { rows, numColumns, totalCells } = useMemo(() => {
    const r = extractTableRows(tnode);
    // numColumns must account for colspan — a row with [td colspan=3][td] has 4 columns, not 2 cells
    let maxCols = 0;
    let cells = 0;
    for (const row of r) {
      let colOffset = 0;
      for (const cell of row.cells) {
        colOffset += getCellColspan(cell);
      }
      maxCols = Math.max(maxCols, colOffset);
      cells += row.cells.length;
    }
    return { rows: r, numColumns: maxCols, totalCells: cells };
  }, [tnode]);

  const [colWidths, setColWidths] = useState<number[] | null>(null);
  const maxWidthsRef = useRef<number[]>([]);
  const measuredCountRef = useRef(0);
  // Generation counter — prevents stale onLayout callbacks from corrupting state
  // after a tnode change triggers measurement reset. Only incremented on RE-measurements
  // (not initial mount), because on mount colWidths is already null and setColWidths(null)
  // is a no-op — no re-render to capture the new generation.
  const generationRef = useRef(0);
  const isInitialMount = useRef(true);

  // Reset measurement when content or column count changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      generationRef.current++;
    }
    maxWidthsRef.current = new Array(numColumns).fill(0);
    measuredCountRef.current = 0;

    // Empty table (no rows/cells) — skip measurement entirely
    if (totalCells === 0) {
      setColWidths([]);
      return;
    }

    setColWidths(null);
  }, [tnode, numColumns, totalCells]);

  const handleCellMeasure = useCallback(
    (colIndex: number, colspan: number, width: number, generation: number) => {
      // Stale callback from a previous measurement phase — ignore
      if (generation !== generationRef.current) return;
      // Guard against out-of-bounds from structural changes
      if (colIndex >= maxWidthsRef.current.length) return;

      if (colspan > 1) {
        // Distribute measured width evenly across spanned columns
        const perCol = width / colspan;
        for (let i = colIndex; i < colIndex + colspan && i < maxWidthsRef.current.length; i++) {
          maxWidthsRef.current[i] = Math.max(maxWidthsRef.current[i] || 0, perCol);
        }
      } else {
        maxWidthsRef.current[colIndex] = Math.max(
          maxWidthsRef.current[colIndex] || 0,
          width,
        );
      }
      measuredCountRef.current++;

      if (measuredCountRef.current >= totalCells) {
        const widths = maxWidthsRef.current.map(w => Math.max(w, MIN_COL_WIDTH));

        // Scale up to fill screen if table is narrower than available width
        const total = widths.reduce((s, w) => s + w, 0);
        if (total > 0 && total < contentWidth) {
          const scale = contentWidth / total;
          for (let i = 0; i < widths.length; i++) {
            widths[i] = Math.round(widths[i] * scale);
          }
        }

        setColWidths(widths);
      }
    },
    [totalCells, contentWidth],
  );

  // Phase 1: Measurement — render cells hidden, each sizing to natural content
  if (!colWidths) {
    // Capture generation at render time so onLayout callbacks can detect staleness
    const currentGeneration = generationRef.current;
    return (
      <View style={styles.measureContainer} pointerEvents="none">
        {rows.map((row, rowIdx) => {
          let colOffset = 0;
          return row.cells.map((cell, cellIdx) => {
            const colspan = getCellColspan(cell);
            const colIdx = colOffset;
            colOffset += colspan;
            return (
              <View
                key={`m-${rowIdx}-${cellIdx}`}
                onLayout={(e) => handleCellMeasure(colIdx, colspan, e.nativeEvent.layout.width, currentGeneration)}
                style={styles.measureCell}
              >
                <TNodeChildrenRenderer tnode={cell} />
              </View>
            );
          });
        })}
      </View>
    );
  }

  // Phase 2: Render table with measured widths
  const tableWidth = Math.max(
    contentWidth,
    colWidths.reduce((s, w) => s + w, 0),
  );

  return (
    <View
      style={styles.tableWrapper}
      onTouchStart={setNativeTableTouched}
      onTouchEnd={clearNativeTableTouched}
      onTouchCancel={clearNativeTableTouched}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* This View must claim the JS responder on touch start. This:
            1. Prevents parent TouchableOpacity from claiming (deepest wins in bubble phase)
            2. Sets mFirstTouchTarget in the native dispatch chain so ScrollView's
               onInterceptTouchEvent fires on ACTION_MOVE and can detect horizontal scroll.
            Without this, TouchableOpacity steals the touch and the ScrollView never
            sees move events — table can only scroll with a quick flick.
            onResponderGrant/Release detect taps (small displacement) and forward them
            to the entry's onPress via HtmlContentPressContext. If ScrollView intercepts
            for horizontal scroll, onResponderTerminate fires instead — no tap. */}
        <View
          style={[styles.table, { borderColor, width: tableWidth }]}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            touchStartRef.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          }}
          onResponderRelease={(e) => {
            const dx = Math.abs(e.nativeEvent.pageX - touchStartRef.current.x);
            const dy = Math.abs(e.nativeEvent.pageY - touchStartRef.current.y);
            if (dx < 10 && dy < 10 && onEntryPress) {
              onEntryPress();
            }
          }}
        >
          {rows.map((row, rowIndex) => {
            let colOffset = 0;
            return (
              <View key={rowIndex} style={styles.tableRow}>
                {row.cells.map((cell, cellIndex) => {
                  const colspan = getCellColspan(cell);
                  const startCol = colOffset;
                  colOffset += colspan;
                  // Sum widths of spanned columns
                  let cellWidth = 0;
                  for (let i = startCol; i < startCol + colspan && i < colWidths.length; i++) {
                    cellWidth += colWidths[i];
                  }
                  if (cellWidth === 0) cellWidth = MIN_COL_WIDTH;

                  return (
                    <View
                      key={cellIndex}
                      style={[
                        styles.tableCell,
                        { borderColor, width: cellWidth },
                        cell.tagName === 'th' && { backgroundColor: headerBg },
                      ]}
                    >
                      <TNodeChildrenRenderer tnode={cell} />
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Renderer dispatch — decides which renderer to use based on data attributes
// ---------------------------------------------------------------------------

/**
 * Custom renderer for <ul> tags.
 * Dispatches to TaskListRenderer if data-type="taskList".
 * Otherwise delegates to InternalRenderer (RNRH's ListElement) which
 * renders proper bullet markers via MarkedListItem.
 *
 * IMPORTANT: Must use InternalRenderer (not TDefaultRenderer) for
 * regular lists — TDefaultRenderer is a generic View that loses
 * bullet/number marker rendering.
 */
function UlRenderer(props: CustomRendererProps<TBlock>) {
  if (props.tnode.attributes['data-type'] === 'taskList') {
    return <TaskListRenderer {...props} />;
  }
  const { InternalRenderer, ...rest } = props;
  return <InternalRenderer {...rest} />;
}

/**
 * Custom renderer for <li> tags.
 * Dispatches to TaskItemRenderer if data-type="taskItem",
 * otherwise falls through to the default renderer (parent list
 * handles marker rendering via its renderChild callback).
 */
function LiRenderer(props: CustomRendererProps<TBlock>) {
  if (props.tnode.attributes['data-type'] === 'taskItem') {
    return <TaskItemRenderer {...props} />;
  }
  const { TDefaultRenderer, tnode, ...rest } = props;
  return <TDefaultRenderer tnode={tnode} {...rest} />;
}

// ---------------------------------------------------------------------------
// Exported renderer record (stable, module-scope)
// ---------------------------------------------------------------------------

export const customRenderers: CustomTagRendererRecord = {
  ul: UlRenderer,
  li: LiRenderer,
  table: TableRenderer,
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Task list
  taskList: {
    paddingLeft: 0,
    marginLeft: 0,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  taskItemChecked: {
    opacity: 0.6,
  },
  taskItemContent: {
    flex: 1,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    marginTop: 2,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },

  // Table — measurement phase
  measureContainer: {
    position: 'absolute',
    opacity: 0,
    // Must be very wide so cells can size to natural content width without
    // wrapping. Without this, the container inherits parent width and long
    // text wraps, giving us the wrapped width instead of the true width.
    width: 10000,
  },
  measureCell: {
    // Must match real cell padding + borders so measurement matches layout
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'transparent',
    // Size to content, don't stretch to parent width
    alignSelf: 'flex-start',
  },

  // Table — layout phase
  tableWrapper: {
    marginVertical: 8,
  },
  table: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
});
