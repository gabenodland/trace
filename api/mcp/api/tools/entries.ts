// Entry CRUD operations for MCP
// All database queries filter by user_id for security

import type { ToolContext } from "./mod";

// ============================================================================
// HTML <-> Markdown Conversion
// ============================================================================

/**
 * Find the end position of a balanced HTML tag block starting at `start`.
 * `start` should point to the '<' of the opening tag.
 * Returns the index AFTER the closing tag, or -1 if not found.
 */
function findBalancedTagEnd(html: string, tagName: string, start: number): number {
  const lower = html.toLowerCase();
  const openTag = `<${tagName.toLowerCase()}`;
  const closeTag = `</${tagName.toLowerCase()}>`;
  const firstAngle = html.indexOf('>', start);
  if (firstAngle === -1) return -1;
  let depth = 1;
  let pos = firstAngle + 1;
  while (depth > 0 && pos < html.length) {
    const nextOpen = lower.indexOf(openTag, pos);
    const nextClose = lower.indexOf(closeTag, pos);
    if (nextClose === -1) return -1;
    let validOpen = -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const c = html[nextOpen + openTag.length];
      if (c === ' ' || c === '>' || c === '\n' || c === '\t' || c === undefined) {
        validOpen = nextOpen;
      }
    }
    if (validOpen !== -1) {
      depth++;
      pos = validOpen + openTag.length;
    } else {
      depth--;
      pos = nextClose + closeTag.length;
    }
  }
  return depth === 0 ? pos : -1;
}

/**
 * Extract direct child elements of a given tag name from HTML.
 * Uses balanced tag matching to handle nesting correctly.
 */
function extractDirectChildren(html: string, tagName: string): string[] {
  const items: string[] = [];
  const lower = html.toLowerCase();
  const open = `<${tagName.toLowerCase()}`;
  let pos = 0;
  while (pos < html.length) {
    const start = lower.indexOf(open, pos);
    if (start === -1) break;
    const c = html[start + open.length];
    if (c !== ' ' && c !== '>' && c !== '\n' && c !== '\t') { pos = start + 1; continue; }
    const end = findBalancedTagEnd(html, tagName, start);
    if (end === -1) break;
    items.push(html.substring(start, end));
    pos = end;
  }
  return items;
}

/**
 * Convert inline HTML to markdown (for content inside list items).
 */
function inlineHtmlToMd(html: string): string {
  return html
    .replace(/<label[^>]*>[\s\S]*?<\/label>/gi, '')
    .replace(/<div[^>]*>/gi, '').replace(/<\/div>/gi, '')
    .replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
    .replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Separate nested <ul>/<ol> blocks from text content inside a list item.
 */
function separateNestedLists(content: string): { text: string; nested: string[] } {
  const nested: string[] = [];
  let text = content;
  let found = true;
  while (found) {
    found = false;
    for (const tag of ['ul', 'ol']) {
      const lower = text.toLowerCase();
      const idx = lower.indexOf(`<${tag}`);
      if (idx === -1) continue;
      const c = text[idx + tag.length + 1];
      if (c !== ' ' && c !== '>' && c !== '\n' && c !== '\t') continue;
      const end = findBalancedTagEnd(text, tag, idx);
      if (end === -1) continue;
      nested.push(text.substring(idx, end));
      text = text.substring(0, idx) + text.substring(end);
      found = true;
      break;
    }
  }
  return { text, nested };
}

/**
 * Recursively convert an HTML list block (<ul>/<ol>) to markdown with proper nesting.
 */
function listBlockToMd(listHtml: string, depth: number): string {
  const outerTag = listHtml.match(/^<(ul|ol)[^>]*>/i);
  if (!outerTag) return '';
  const tagName = outerTag[1].toLowerCase();
  const isOrdered = tagName === 'ol';
  const openEnd = listHtml.indexOf('>') + 1;
  const closeIdx = listHtml.toLowerCase().lastIndexOf(`</${tagName}>`);
  if (closeIdx === -1) return '';
  const innerHtml = listHtml.substring(openEnd, closeIdx);
  const items = extractDirectChildren(innerHtml, 'li');
  const indent = '  '.repeat(depth);
  let md = '';
  let orderNum = 1;
  for (const itemHtml of items) {
    const liTag = itemHtml.match(/^<li[^>]*>/i)?.[0] || '<li>';
    const isChecked = /data-checked=["']true["']/i.test(liTag);
    const isUnchecked = /data-checked=["']false["']/i.test(liTag);
    const contentStart = liTag.length;
    const contentEnd = itemHtml.length - 5; // '</li>'.length
    const rawContent = itemHtml.substring(contentStart, contentEnd);
    const { text: textPart, nested } = separateNestedLists(rawContent);
    const cleanText = inlineHtmlToMd(textPart);
    if (isChecked || isUnchecked) {
      md += `${indent}- [${isChecked ? 'x' : ' '}] ${cleanText}\n`;
    } else if (isOrdered) {
      md += `${indent}${orderNum}. ${cleanText}\n`;
      orderNum++;
    } else {
      md += `${indent}- ${cleanText}\n`;
    }
    for (const nestedList of nested) {
      md += listBlockToMd(nestedList, depth + 1);
    }
  }
  return md;
}

/**
 * Find and convert all top-level HTML list blocks to markdown.
 * Replaces each <ul>/<ol> block (including nested children) with properly indented markdown.
 */
function convertHtmlListsToMd(html: string): string {
  let result = html;
  const blocks: { start: number; end: number }[] = [];
  let pos = 0;
  while (pos < result.length) {
    const lower = result.toLowerCase();
    let nextStart = -1;
    let tag = '';
    const nextUl = lower.indexOf('<ul', pos);
    const nextOl = lower.indexOf('<ol', pos);
    // Pick the nearest valid list tag
    for (const [idx, t] of [[nextUl, 'ul'], [nextOl, 'ol']] as [number, string][]) {
      if (idx === -1) continue;
      const c = result[idx + t.length + 1];
      if (c !== ' ' && c !== '>' && c !== '\n' && c !== '\t') continue;
      if (nextStart === -1 || idx < nextStart) { nextStart = idx; tag = t; }
    }
    if (nextStart === -1) break;
    const end = findBalancedTagEnd(result, tag, nextStart);
    if (end === -1) { pos = nextStart + 1; continue; }
    blocks.push({ start: nextStart, end });
    pos = end;
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    const { start, end } = blocks[i];
    const blockHtml = result.substring(start, end);
    const md = listBlockToMd(blockHtml, 0);
    result = result.substring(0, start) + '\n' + md + result.substring(end);
  }
  return result;
}

// --- Markdown → HTML list helpers ---

interface MdListItem {
  indent: number;
  type: 'task-checked' | 'task-unchecked' | 'bullet' | 'ordered';
  content: string;
}

function isMarkdownListLine(line: string): boolean {
  return /^\s*(- \[x\] |- \[ \] |- |\d+\. )/.test(line);
}

function parseMdListLine(line: string): MdListItem | null {
  const match = line.match(/^(\s*)(- \[x\] |- \[ \] |- |\d+\. )(.*)$/);
  if (!match) return null;
  const indent = match[1].length;
  const marker = match[2].trimEnd();
  const content = match[3];
  let type: MdListItem['type'];
  if (marker === '- [x]') type = 'task-checked';
  else if (marker === '- [ ]') type = 'task-unchecked';
  else if (marker === '-') type = 'bullet';
  else type = 'ordered';
  return { indent, type, content };
}

function buildNestedListHtml(items: MdListItem[], startIdx: number, baseIndent: number): { html: string; nextIdx: number } {
  if (startIdx >= items.length) return { html: '', nextIdx: startIdx };
  const first = items[startIdx];
  const isTask = first.type === 'task-checked' || first.type === 'task-unchecked';
  const isOrdered = first.type === 'ordered';
  const openTag = isTask ? '<ul data-type="taskList">' : (isOrdered ? '<ol>' : '<ul>');
  const closeTag = isTask ? '</ul>' : (isOrdered ? '</ol>' : '</ul>');
  let html = openTag;
  let i = startIdx;
  while (i < items.length && items[i].indent >= baseIndent) {
    if (items[i].indent > baseIndent) {
      const nested = buildNestedListHtml(items, i, items[i].indent);
      // Reopen previous li to attach nested list, then close it
      if (html.endsWith('</li>')) {
        html = html.slice(0, -5) + nested.html + '</li>';
      } else {
        html += nested.html;
      }
      i = nested.nextIdx;
      continue;
    }
    const item = items[i];
    if (item.type === 'task-checked' || item.type === 'task-unchecked') {
      const checked = item.type === 'task-checked';
      html += `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label><div><p>${item.content}</p></div>`;
    } else {
      html += `<li><p>${item.content}</p>`;
    }
    i++;
    if (i < items.length && items[i].indent > baseIndent) {
      const nested = buildNestedListHtml(items, i, items[i].indent);
      html += nested.html;
      i = nested.nextIdx;
    }
    html += '</li>';
  }
  html += closeTag;
  return { html, nextIdx: i };
}

function convertMdListsToHtml(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (isMarkdownListLine(lines[i])) {
      const listLines: string[] = [];
      while (i < lines.length) {
        if (isMarkdownListLine(lines[i])) {
          listLines.push(lines[i]);
          i++;
        } else if (lines[i].trim() === '' && i + 1 < lines.length && isMarkdownListLine(lines[i + 1])) {
          i++; // Skip blank line between list items
        } else {
          break;
        }
      }
      const items = listLines.map(parseMdListLine).filter((x): x is MdListItem => x !== null);
      if (items.length > 0) {
        const { html } = buildNestedListHtml(items, 0, items[0].indent);
        result.push(html);
      }
    } else {
      result.push(lines[i]);
      i++;
    }
  }
  return result.join('\n');
}

/**
 * Convert HTML content to Markdown for AI readability
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";

  let md = html;

  // Handle tables FIRST — before any other transforms that would inject
  // markdown syntax (headings, lists, blockquotes) into cell content.
  // Tables are extracted from raw HTML so cell content is still HTML tags.
  md = md.replace(/<colgroup>[\s\S]*?<\/colgroup>/gi, "");
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match: string, tableContent: string) => {
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        let cellContent = cellMatch[1]
          // Strip block-level HTML tags (cells should be inline content in GFM)
          .replace(/<p[^>]*>/gi, "")
          .replace(/<\/p>/gi, " ")
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<h[1-6][^>]*>/gi, "")
          .replace(/<\/h[1-6]>/gi, " ")
          .replace(/<ul[^>]*>/gi, "")
          .replace(/<\/ul>/gi, "")
          .replace(/<ol[^>]*>/gi, "")
          .replace(/<\/ol>/gi, "")
          .replace(/<li[^>]*>/gi, "")
          .replace(/<\/li>/gi, " ")
          .replace(/<blockquote[^>]*>/gi, "")
          .replace(/<\/blockquote>/gi, " ");
        // Convert inline formatting to markdown
        cellContent = cellContent.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
        cellContent = cellContent.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
        cellContent = cellContent.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
        cellContent = cellContent.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");
        cellContent = cellContent.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
        cellContent = cellContent.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
        // Strip any remaining HTML tags
        cellContent = cellContent.replace(/<[^>]+>/g, "");
        // Escape pipe characters that would break GFM table syntax
        cellContent = cellContent.replace(/\|/g, "\\|");
        // Collapse whitespace
        cellContent = cellContent.replace(/\s+/g, " ").trim();
        if (!cellContent) cellContent = " ";
        cells.push(cellContent);
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length === 0) return "";

    const colCount = Math.max(...rows.map((r) => r.length));
    const lines: string[] = [];
    const header = rows[0];
    while (header.length < colCount) header.push(" ");
    lines.push("| " + header.join(" | ") + " |");
    lines.push("| " + header.map(() => "---").join(" | ") + " |");
    for (let i = 1; i < rows.length; i++) {
      while (rows[i].length < colCount) rows[i].push(" ");
      lines.push("| " + rows[i].join(" | ") + " |");
    }
    return "\n" + lines.join("\n") + "\n\n";
  });

  // Handle lists — recursive parser for proper nesting (must run before
  // headings/formatting regexes which would mangle content inside <li> tags)
  md = convertHtmlListsToMd(md);

  // Handle headings (h1-h6)
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  // Handle formatting
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");
  md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, "~~$1~~");
  md = md.replace(/<strike[^>]*>(.*?)<\/strike>/gi, "~~$1~~");
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

  // Handle links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Handle images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

  // Lists already handled by convertHtmlListsToMd above

  // Handle blockquotes
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
    const lines = content.trim().split("\n");
    return lines.map((line: string) => `> ${line}`).join("\n") + "\n\n";
  });

  // Handle code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```\n\n");
  md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gis, "```\n$1\n```\n\n");

  // Handle paragraphs
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");

  // Handle line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Handle horizontal rules
  md = md.replace(/<hr\s*\/?>/gi, "\n---\n\n");

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  md = md.replace(/&nbsp;/g, " ");
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&#x27;/g, "'");
  md = md.replace(/&#x2F;/g, "/");

  // Clean up excessive whitespace
  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.trim();

  return md;
}

/**
 * Convert Markdown content to HTML for storage
 */
export function markdownToHtml(md: string): string {
  if (!md) return "";

  let html = md;

  // Escape HTML entities first
  html = html.replace(/&/g, "&amp;");
  html = html.replace(/</g, "&lt;");
  html = html.replace(/>/g, "&gt;");

  // Handle code blocks first (to prevent interference)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Handle inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Handle GFM tables FIRST — before heading/list/blockquote transforms
  // that would corrupt cell content containing markdown syntax.
  // Separator validation requires each column to match :?-+:? (proper GFM).
  html = html.replace(
    /^(\|.+\|)\n(\|[\s|:-]+\|)\n((?:\|.+\|(?:\n|$))*)/gm,
    (_match, headerLine: string, separator: string, bodyBlock: string) => {
      const parseRow = (line: string): string[] =>
        line.split("|").slice(1, -1).map((cell) => cell.trim());

      // Validate separator — each column must be :?-+:?
      const sepCells = parseRow(separator);
      const validSep = sepCells.every((cell) => /^\s*:?-+:?\s*$/.test(cell));
      if (!validSep || sepCells.length === 0) return _match;

      const headers = parseRow(headerLine);
      const colCount = headers.length;
      if (colCount === 0) return _match;

      const colgroup =
        "<colgroup>" + headers.map(() => "<col>").join("") + "</colgroup>";

      const headerCells = headers
        .map((h) => `<th colspan="1" rowspan="1"><p>${h || ""}</p></th>`)
        .join("");
      const headerRow = `<tr>${headerCells}</tr>`;

      const bodyLines = bodyBlock.trim().split("\n").filter(Boolean);
      const bodyRows = bodyLines
        .map((line: string) => {
          const cells = parseRow(line);
          while (cells.length < colCount) cells.push("");
          const tds = cells
            .map((c) => `<td colspan="1" rowspan="1"><p>${c || ""}</p></td>`)
            .join("");
          return `<tr>${tds}</tr>`;
        })
        .join("");

      return `<table class="trace-table">${colgroup}<thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
    }
  );

  // Handle headings
  html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Handle bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Handle links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Handle images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Handle horizontal rules
  html = html.replace(/^---$/gm, "<hr />");
  html = html.replace(/^\*\*\*$/gm, "<hr />");

  // Handle blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // Handle lists — recursive parser for proper nesting
  html = convertMdListsToHtml(html);

  // Handle paragraphs (lines not already wrapped)
  const lines = html.split("\n\n");
  html = lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      // Skip if already has block-level tags
      if (/^<(h[1-6]|ul|ol|li|pre|blockquote|hr|p|table)/.test(trimmed)) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  return html;
}

// ============================================================================
// Entry Types
// ============================================================================

interface ListEntriesParams {
  stream_id?: string | null;
  tags?: string[];
  status?: string;
  is_archived?: boolean;
  is_pinned?: boolean;
  start_date?: string;
  end_date?: string;
  query?: string;
  limit?: number;
  offset?: number;
  include_content?: boolean; // Default: true. Set to false for lighter responses.
  content_limit?: number; // Truncate content to first N characters (ignored if include_content is false)
}

interface GetEntryParams {
  entry_id: string;
}

interface CreateEntryParams {
  title?: string;
  content: string;
  stream_id?: string | null;
  tags?: string[];
  status?: string;
  entry_date?: string;
  priority?: number;
  rating?: number;
  type?: string | null;
  due_date?: string | null;
}

interface UpdateEntryParams {
  entry_id: string;
  expected_version?: number; // For optimistic locking - only update if version matches
  title?: string;
  content?: string;
  stream_id?: string | null;
  tags?: string[];
  status?: string;
  is_archived?: boolean;
  is_pinned?: boolean;
  priority?: number;
  rating?: number;
  type?: string | null;
  due_date?: string | null;
}

interface DeleteEntryParams {
  entry_id: string;
}

interface SearchEntriesParams {
  query: string;
  limit?: number;
  include_content?: boolean; // Default: true. Set to false for lighter responses.
  content_limit?: number; // Truncate content to first N characters (ignored if include_content is false)
}

// ============================================================================
// Priority Labels (mirrors @trace/core ALL_PRIORITIES)
// ============================================================================

const PRIORITY_LABELS: Record<number, string> = {
  4: "Urgent",
  3: "High",
  2: "Medium",
  1: "Low",
  0: "None",
};

const VALID_PRIORITIES = [0, 1, 2, 3, 4];

function getPriorityLabel(value: number): string {
  return PRIORITY_LABELS[value] || "None";
}

// ============================================================================
// Stream Context for Entries
// ============================================================================

interface StreamSettings {
  stream_id: string;
  name: string;
  entry_use_rating: boolean;
  entry_use_status: boolean;
  entry_use_priority: boolean;
  entry_use_type: boolean;
  entry_use_duedates: boolean;
  entry_types: string[] | null;
  entry_statuses: string[] | null;
  entry_default_status: string | null;
  entry_rating_type: string | null; // "stars" or "numeric"
}

interface StreamContext {
  stream_id: string;
  stream_name: string;
  rating_type: string; // "stars" or "numeric"
  rating_max: number; // 5 for stars, 10 for numeric
  types: string[];
  statuses: string[];
  use_rating: boolean;
  use_status: boolean;
  use_priority: boolean;
  use_type: boolean;
  use_duedates: boolean;
}

/**
 * Convert raw rating (0-10) to display value based on stream rating type
 */
function convertRatingToDisplay(rawRating: number, ratingType: string | null): number {
  if (ratingType === "stars") {
    // Stars are stored as 0-10 internally, display as 0-5
    return Math.round(rawRating / 2);
  }
  // Numeric ratings are displayed as-is (0-10)
  return rawRating;
}

/**
 * Convert display rating to raw storage value based on stream rating type
 */
function convertRatingToRaw(displayRating: number, ratingType: string | null): number {
  if (ratingType === "stars") {
    // Stars: display 0-5 -> storage 0-10
    return displayRating * 2;
  }
  // Numeric ratings are stored as-is (0-10)
  return displayRating;
}

/**
 * Get the maximum valid rating for a stream's rating type
 */
function getMaxRating(ratingType: string | null): number {
  return ratingType === "stars" ? 5 : 10;
}

/**
 * Build stream context from stream settings
 */
function buildStreamContext(stream: StreamSettings): StreamContext {
  const ratingType = stream.entry_rating_type || "numeric";
  return {
    stream_id: stream.stream_id,
    stream_name: stream.name,
    rating_type: ratingType,
    rating_max: getMaxRating(ratingType),
    types: stream.entry_types || [],
    statuses: stream.entry_statuses || [],
    use_rating: stream.entry_use_rating,
    use_status: stream.entry_use_status,
    use_priority: stream.entry_use_priority,
    use_type: stream.entry_use_type ?? false,
    use_duedates: stream.entry_use_duedates,
  };
}

/**
 * Fetch stream settings for one or more stream IDs
 * Returns a map of stream_id -> StreamContext
 */
async function fetchStreamContexts(
  streamIds: (string | null)[],
  ctx: ToolContext
): Promise<Map<string | null, StreamContext>> {
  const contextMap = new Map<string | null, StreamContext>();

  // Filter out nulls (inbox entries) and dedupe
  const uniqueIds = [...new Set(streamIds.filter((id): id is string => id !== null))];

  if (uniqueIds.length === 0) {
    return contextMap;
  }

  const { data: streams, error } = await ctx.supabase
    .from("streams")
    .select("stream_id, name, entry_use_rating, entry_use_status, entry_use_priority, entry_use_type, entry_use_duedates, entry_types, entry_statuses, entry_default_status, entry_rating_type")
    .eq("user_id", ctx.userId)
    .in("stream_id", uniqueIds);

  if (error) {
    console.error("[MCP] Failed to fetch stream contexts:", error);
    return contextMap;
  }

  for (const stream of (streams || []) as StreamSettings[]) {
    contextMap.set(stream.stream_id, buildStreamContext(stream));
  }

  return contextMap;
}

/**
 * Sanitize database error messages to prevent information disclosure.
 * Hides internal constraint names and schema details.
 */
function sanitizeDbError(error: { message: string; code?: string }): string {
  // Known error codes that are safe to pass through with context
  if (error.code === "PGRST116") {
    return "Record not found";
  }
  if (error.code === "23505") {
    return "A record with this identifier already exists";
  }
  if (error.code === "23503") {
    return "Referenced record does not exist";
  }
  if (error.code === "23514") {
    return "Value violates validation constraints";
  }

  // For other errors, return generic message
  // Log the full error server-side for debugging
  console.error("[MCP] Database error:", error);
  return "Database operation failed";
}

// ============================================================================
// Entry Response Transformation
// ============================================================================

interface EntryRow {
  entry_id: string;
  user_id: string;
  title: string | null;
  content: string;
  tags: string[] | null;
  mentions: string[] | null;
  stream_id: string | null;
  status: string;
  type: string | null;
  entry_date: string | null;
  entry_latitude: number | null;
  entry_longitude: number | null;
  place_name: string | null;
  city: string | null;
  country: string | null;
  priority: number;
  rating: number;
  is_pinned: boolean;
  is_archived: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  last_edited_device: string | null;
  version: number; // For optimistic locking
}

interface AttachmentRow {
  attachment_id: string;
  entry_id: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  position: number;
}

interface TransformOptions {
  includeContent?: boolean; // Default: true
  contentLimit?: number; // Truncate content to first N chars (only if includeContent is true)
}

/**
 * Transform entry row to API response with Markdown content
 * Includes stream context and converted rating values
 * @param options.includeContent - If false, omits content field (default: true)
 */
function transformEntry(
  entry: EntryRow,
  attachments?: AttachmentRow[],
  streamContext?: StreamContext | null,
  options?: TransformOptions
) {
  // Get rating type from stream context, default to "numeric" for inbox
  const ratingType = streamContext?.rating_type || "numeric";
  const ratingMax = streamContext?.rating_max || 10;
  const displayRating = convertRatingToDisplay(entry.rating, ratingType);

  // Default include_content to true for backwards compatibility
  const includeContent = options?.includeContent !== false;
  const contentLimit = options?.contentLimit;

  // Build content field
  let content: string | null = null;
  let contentTruncated = false;
  if (includeContent) {
    const fullContent = htmlToMarkdown(entry.content);
    if (contentLimit && contentLimit > 0 && fullContent.length > contentLimit) {
      content = fullContent.substring(0, contentLimit) + "...";
      contentTruncated = true;
    } else {
      content = fullContent;
    }
  }

  const transformed: Record<string, unknown> = {
    entry_id: entry.entry_id,
    title: entry.title,
    content,
    content_truncated: contentTruncated,
    tags: entry.tags || [],
    mentions: entry.mentions || [],
    stream_id: entry.stream_id,
    status: entry.status,
    type: entry.type,
    entry_date: entry.entry_date,
    location: entry.entry_latitude && entry.entry_longitude
      ? {
          latitude: entry.entry_latitude,
          longitude: entry.entry_longitude,
          place_name: entry.place_name,
          city: entry.city,
          country: entry.country,
        }
      : null,
    priority: entry.priority,
    priority_label: getPriorityLabel(entry.priority),
    // Rating: display value and metadata
    rating: displayRating,
    rating_max: ratingMax,
    rating_type: ratingType,
    rating_raw: entry.rating, // Raw storage value for round-tripping if needed
    is_pinned: entry.is_pinned,
    is_archived: entry.is_archived,
    due_date: entry.due_date,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    last_edited_device: entry.last_edited_device,
    version: entry.version, // For optimistic locking - pass to expected_version on updates
    attachments: attachments?.map((a) => ({
      attachment_id: a.attachment_id,
      mime_type: a.mime_type,
      file_size: a.file_size,
      width: a.width,
      height: a.height,
      position: a.position,
    })),
  };

  // Include stream context if available (not for inbox entries)
  if (streamContext) {
    transformed.stream_context = {
      stream_name: streamContext.stream_name,
      rating_type: streamContext.rating_type,
      rating_max: streamContext.rating_max,
      types: streamContext.types,
      statuses: streamContext.statuses,
      use_rating: streamContext.use_rating,
      use_status: streamContext.use_status,
      use_priority: streamContext.use_priority,
      use_type: streamContext.use_type,
      use_duedates: streamContext.use_duedates,
    };
  }

  return transformed;
}

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * List entries with optional filters
 */
export async function listEntries(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = (params || {}) as ListEntriesParams;

  // Validate and cap limits
  const limit = Math.min(Math.max(1, p.limit || 50), 100);
  const offset = Math.max(0, p.offset || 0);

  let query = ctx.supabase
    .from("entries")
    .select("*")
    .eq("user_id", ctx.userId)
    .is("deleted_at", null) // Exclude soft-deleted
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (p.stream_id !== undefined) {
    if (p.stream_id === null) {
      query = query.is("stream_id", null); // Inbox
    } else {
      query = query.eq("stream_id", p.stream_id);
    }
  }

  if (p.tags && p.tags.length > 0) {
    // Match ANY of the provided tags
    query = query.overlaps("tags", p.tags);
  }

  if (p.status) {
    query = query.eq("status", p.status);
  }

  // Default to non-archived unless explicitly requested
  if (p.is_archived !== undefined) {
    query = query.eq("is_archived", p.is_archived);
  } else {
    query = query.eq("is_archived", false);
  }

  if (p.is_pinned !== undefined) {
    query = query.eq("is_pinned", p.is_pinned);
  }

  if (p.start_date) {
    query = query.gte("entry_date", p.start_date);
  }

  if (p.end_date) {
    query = query.lte("entry_date", p.end_date);
  }

  // Basic text search (case-insensitive on title and content)
  if (p.query) {
    query = query.or(
      `title.ilike.%${p.query}%,content.ilike.%${p.query}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list entries: ${sanitizeDbError(error)}`);
  }

  const entries = data || [];

  // Fetch stream contexts for all entries
  const streamIds = entries.map((e) => (e as EntryRow).stream_id);
  const streamContexts = await fetchStreamContexts(streamIds, ctx);

  // Transform options - include_content defaults to true
  const transformOptions: TransformOptions = {
    includeContent: p.include_content !== false,
    contentLimit: p.content_limit,
  };

  return {
    entries: entries.map((entry) => {
      const e = entry as EntryRow;
      const streamContext = e.stream_id ? streamContexts.get(e.stream_id) : null;
      return transformEntry(e, undefined, streamContext, transformOptions);
    }),
    count: entries.length,
    limit,
    offset,
    include_content: transformOptions.includeContent,
    content_limit: transformOptions.contentLimit || null,
  };
}

/**
 * Get a single entry by ID with attachments
 */
export async function getEntry(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as GetEntryParams;

  if (!p?.entry_id) {
    throw new Error("entry_id is required");
  }

  // Fetch entry
  const { data: entry, error: entryError } = await ctx.supabase
    .from("entries")
    .select("*")
    .eq("entry_id", p.entry_id)
    .eq("user_id", ctx.userId) // Security: ensure user owns entry
    .is("deleted_at", null)
    .single();

  if (entryError) {
    if (entryError.code === "PGRST116") {
      throw new Error("Entry not found");
    }
    throw new Error(`Failed to get entry: ${sanitizeDbError(entryError)}`);
  }

  // Fetch attachments for this entry
  const { data: attachments } = await ctx.supabase
    .from("attachments")
    .select("attachment_id, entry_id, file_path, mime_type, file_size, width, height, position")
    .eq("entry_id", p.entry_id)
    .eq("user_id", ctx.userId)
    .order("position", { ascending: true });

  // Fetch stream context if entry belongs to a stream
  const typedEntry = entry as EntryRow;
  let streamContext: StreamContext | null = null;
  if (typedEntry.stream_id) {
    const contexts = await fetchStreamContexts([typedEntry.stream_id], ctx);
    streamContext = contexts.get(typedEntry.stream_id) || null;
  }

  return transformEntry(typedEntry, attachments as AttachmentRow[] || [], streamContext);
}

/**
 * Create a new entry
 */
export async function createEntry(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as CreateEntryParams;

  if (!p?.content) {
    throw new Error("content is required");
  }

  // Fetch stream settings for validation if stream_id is provided
  let streamSettings: StreamSettings | null = null;
  if (p.stream_id) {
    const { data: stream } = await ctx.supabase
      .from("streams")
      .select("stream_id, name, entry_use_rating, entry_use_status, entry_use_priority, entry_use_type, entry_use_duedates, entry_types, entry_statuses, entry_default_status, entry_rating_type")
      .eq("stream_id", p.stream_id)
      .eq("user_id", ctx.userId)
      .single();

    if (!stream) {
      throw new Error("Stream not found or not owned by user");
    }
    streamSettings = stream as StreamSettings;
  }

  const now = new Date().toISOString();

  const insertData: Record<string, unknown> = {
    user_id: ctx.userId,
    title: p.title || null,
    content: markdownToHtml(p.content), // Convert Markdown to HTML
    tags: p.tags || null,
    stream_id: p.stream_id || null,
    status: p.status || streamSettings?.entry_default_status || "none",
    entry_date: p.entry_date || now.split("T")[0],
    created_at: now,
    updated_at: now,
  };

  // Validate and set priority if provided
  if (p.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(p.priority)) {
      throw new Error("priority must be 0 (None), 1 (Low), 2 (Medium), 3 (High), or 4 (Urgent)");
    }
    insertData.priority = p.priority;
  }

  // Validate and set rating if provided
  if (p.rating !== undefined) {
    const ratingType = streamSettings?.entry_rating_type || "numeric";
    const maxRating = getMaxRating(ratingType);

    if (p.rating < 0 || p.rating > maxRating) {
      if (ratingType === "stars") {
        throw new Error(`Rating must be 0-${maxRating} for star-based streams`);
      } else {
        throw new Error(`Rating must be 0-${maxRating}`);
      }
    }

    // Convert display rating to raw storage value
    insertData.rating = convertRatingToRaw(p.rating, ratingType);
  }

  // Set type if provided
  if (p.type !== undefined) {
    insertData.type = p.type;
  }

  // Set due_date if provided
  if (p.due_date !== undefined) {
    insertData.due_date = p.due_date;
  }

  const { data, error } = await ctx.supabase
    .from("entries")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create entry: ${sanitizeDbError(error)}`);
  }

  // Fetch stream context for response
  let streamContext: StreamContext | null = null;
  if (p.stream_id && streamSettings) {
    streamContext = buildStreamContext(streamSettings);
  }

  return transformEntry(data as EntryRow, undefined, streamContext);
}

/**
 * Update an existing entry
 */
export async function updateEntry(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as UpdateEntryParams;

  if (!p?.entry_id) {
    throw new Error("entry_id is required");
  }

  // First, fetch current entry to get version and stream_id for validation
  const { data: currentEntry, error: fetchError } = await ctx.supabase
    .from("entries")
    .select("version, stream_id")
    .eq("entry_id", p.entry_id)
    .eq("user_id", ctx.userId)
    .is("deleted_at", null)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new Error("Entry not found or not owned by user");
    }
    throw new Error(`Failed to fetch entry: ${sanitizeDbError(fetchError)}`);
  }

  const currentVersion = (currentEntry as { version: number | null })?.version || 1;

  // OPTIMISTIC LOCKING: If expected_version provided, verify it matches
  if (p.expected_version !== undefined && p.expected_version !== currentVersion) {
    throw new Error(
      `Version conflict: expected version ${p.expected_version} but server has version ${currentVersion}. ` +
      `The entry was modified since you last read it. Please re-fetch the entry and retry your update.`
    );
  }

  // Determine the target stream_id (either new one being set, or existing)
  const targetStreamId = p.stream_id !== undefined ? p.stream_id : (currentEntry as { stream_id: string | null }).stream_id;

  // Fetch stream settings for validation if entry belongs to a stream
  let streamSettings: StreamSettings | null = null;
  if (targetStreamId) {
    const { data: stream } = await ctx.supabase
      .from("streams")
      .select("stream_id, name, entry_use_rating, entry_use_status, entry_use_priority, entry_use_type, entry_use_duedates, entry_types, entry_statuses, entry_default_status, entry_rating_type")
      .eq("stream_id", targetStreamId)
      .eq("user_id", ctx.userId)
      .single();
    streamSettings = stream as StreamSettings | null;
  }

  // Build update object with only provided fields
  // Increment version to trigger sync on mobile app
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    version: currentVersion + 1,
  };

  if (p.title !== undefined) {
    updateData.title = p.title;
  }

  if (p.content !== undefined) {
    updateData.content = markdownToHtml(p.content);
  }

  if (p.stream_id !== undefined) {
    updateData.stream_id = p.stream_id;
  }

  if (p.tags !== undefined) {
    updateData.tags = p.tags;
  }

  if (p.status !== undefined) {
    updateData.status = p.status;
  }

  if (p.is_archived !== undefined) {
    updateData.is_archived = p.is_archived;
  }

  if (p.is_pinned !== undefined) {
    updateData.is_pinned = p.is_pinned;
  }

  if (p.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(p.priority)) {
      throw new Error("priority must be 0 (None), 1 (Low), 2 (Medium), 3 (High), or 4 (Urgent)");
    }
    updateData.priority = p.priority;
  }

  if (p.rating !== undefined) {
    // Validate rating against stream settings
    const ratingType = streamSettings?.entry_rating_type || "numeric";
    const maxRating = getMaxRating(ratingType);

    if (p.rating < 0 || p.rating > maxRating) {
      if (ratingType === "stars") {
        throw new Error(`Rating must be 0-${maxRating} for star-based streams`);
      } else {
        throw new Error(`Rating must be 0-${maxRating}`);
      }
    }

    // Convert display rating to raw storage value
    updateData.rating = convertRatingToRaw(p.rating, ratingType);
  }

  if (p.type !== undefined) {
    updateData.type = p.type;
  }

  if (p.due_date !== undefined) {
    updateData.due_date = p.due_date;
  }

  // Set last_edited_device to identify MCP edits
  updateData.last_edited_device = `MCP:${ctx.keyName}`;

  // Use conditional update with version check to prevent race conditions
  // This ensures another update didn't happen between our version check and now
  const { data, error } = await ctx.supabase
    .from("entries")
    .update(updateData)
    .eq("entry_id", p.entry_id)
    .eq("user_id", ctx.userId) // Security: ensure user owns entry
    .eq("version", currentVersion) // OPTIMISTIC LOCK: only update if version unchanged
    .is("deleted_at", null)
    .select()
    .maybeSingle(); // Use maybeSingle since conditional update may return no rows

  if (error) {
    throw new Error(`Failed to update entry: ${sanitizeDbError(error)}`);
  }

  // If no data returned, it means the version changed between our check and update
  if (!data) {
    // Re-fetch to get current version for error message
    const { data: latestEntry } = await ctx.supabase
      .from("entries")
      .select("version")
      .eq("entry_id", p.entry_id)
      .eq("user_id", ctx.userId)
      .single();

    const latestVersion = (latestEntry as { version: number } | null)?.version || "unknown";
    throw new Error(
      `Version conflict: entry was modified by another source (now at version ${latestVersion}). ` +
      `Please re-fetch the entry and retry your update.`
    );
  }

  // Fetch stream context for response
  let streamContext: StreamContext | null = null;
  if ((data as EntryRow).stream_id) {
    const contexts = await fetchStreamContexts([(data as EntryRow).stream_id], ctx);
    streamContext = contexts.get((data as EntryRow).stream_id) || null;
  }

  return transformEntry(data as EntryRow, undefined, streamContext);
}

/**
 * Soft-delete an entry
 */
export async function deleteEntry(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as DeleteEntryParams;

  if (!p?.entry_id) {
    throw new Error("entry_id is required");
  }

  const { data, error } = await ctx.supabase
    .from("entries")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("entry_id", p.entry_id)
    .eq("user_id", ctx.userId) // Security: ensure user owns entry
    .is("deleted_at", null) // Can't delete already deleted
    .select("entry_id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("Entry not found or already deleted");
    }
    throw new Error(`Failed to delete entry: ${sanitizeDbError(error)}`);
  }

  return {
    deleted: true,
    entry_id: data.entry_id,
  };
}

/**
 * Full-text search across entries
 */
export async function searchEntries(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as SearchEntriesParams;

  if (!p?.query) {
    throw new Error("query is required");
  }

  // Validate and cap limits
  const limit = Math.min(Math.max(1, p.limit || 20), 50);

  // Search in title and content
  const { data, error } = await ctx.supabase
    .from("entries")
    .select("*")
    .eq("user_id", ctx.userId)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .or(`title.ilike.%${p.query}%,content.ilike.%${p.query}%`)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Search failed: ${sanitizeDbError(error)}`);
  }

  const entries = data || [];

  // Fetch stream contexts for all entries
  const streamIds = entries.map((e) => (e as EntryRow).stream_id);
  const streamContexts = await fetchStreamContexts(streamIds, ctx);

  // Transform options - include_content defaults to true
  const transformOptions: TransformOptions = {
    includeContent: p.include_content !== false,
    contentLimit: p.content_limit,
  };

  return {
    entries: entries.map((entry) => {
      const e = entry as EntryRow;
      const streamContext = e.stream_id ? streamContexts.get(e.stream_id) : null;
      return transformEntry(e, undefined, streamContext, transformOptions);
    }),
    count: entries.length,
    query: p.query,
    include_content: transformOptions.includeContent,
    content_limit: transformOptions.contentLimit || null,
  };
}
