/**
 * Template Helpers
 *
 * Functions for applying stream templates to new entries.
 * Supports variable substitution and basic markdown conversion.
 *
 * Supported Variables:
 * - {date} - Locale-aware full date (e.g., "January 6, 2026" or "6 January 2026")
 * - {date_short} - Locale-aware short date (e.g., "1/6/26" or "6/1/26")
 * - {weekday} - Day of week name (e.g., "Monday")
 * - {day} - Day of month number (e.g., "6")
 * - {month} - Month number (e.g., "1")
 * - {month_name} - Month name (e.g., "January")
 * - {year} - Full year (e.g., "2026")
 * - {year_short} - 2-digit year (e.g., "26")
 * - {stream} - Stream name
 * - {time} - Current time (e.g., "2:30 PM")
 *
 * Supported Markdown:
 * - # Header 1, ## Header 2, ### Header 3
 * - **bold** or *bold*
 * - _italic_
 * - - bullet item
 * - 1. numbered item
 * - [ ] unchecked checkbox
 * - [x] or [X] checked checkbox
 */

export interface TemplateVariables {
  date?: Date;
  streamName?: string;
}

/**
 * Get all template variables for a given date and stream
 * Uses locale-aware formatting for date/date_short to respect user's region
 */
export function getTemplateVariables(
  date: Date = new Date(),
  streamName: string = ""
): Record<string, string> {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const weekdays = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
  ];

  const monthNum = date.getMonth();
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  const year = date.getFullYear();

  // Locale-aware date formatting
  const dateFull = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const dateShort = date.toLocaleDateString(undefined, {
    year: "2-digit",
    month: "numeric",
    day: "numeric",
  });

  // Format time (e.g., "2:30 PM") - locale-aware
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    date: dateFull,
    date_short: dateShort,
    weekday: weekdays[dayOfWeek],
    day: dayOfMonth.toString(),
    month: (monthNum + 1).toString(),
    month_name: months[monthNum],
    year: year.toString(),
    year_short: year.toString().slice(-2),
    stream: streamName,
    time: timeStr,
  };
}

/**
 * Replace template variables in a string
 */
export function replaceVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    // Replace both {key} and {KEY} (case-insensitive)
    const regex = new RegExp(`\\{${key}\\}`, "gi");
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Apply title template with variable substitution
 */
export function applyTitleTemplate(
  template: string | null | undefined,
  options: TemplateVariables = {}
): string {
  if (!template) return "";

  const variables = getTemplateVariables(
    options.date || new Date(),
    options.streamName || ""
  );

  return replaceVariables(template, variables);
}

/**
 * Convert basic markdown to HTML
 * Supports: headers, bold, italic, bullets, numbered lists, checkboxes
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const htmlLines: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Check if this is a list item
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    const numberedMatch = line.match(/^\d+\.\s+(.*)$/);
    const checkboxMatch = line.match(/^\[([xX ])\]\s*(.*)$/);

    // Handle checkboxes (treat as special bullets)
    if (checkboxMatch) {
      const isChecked = checkboxMatch[1].toLowerCase() === "x";
      const content = checkboxMatch[2];
      const checkbox = isChecked ? "☑" : "☐";

      if (!inList || listType !== "ul") {
        if (inList) htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
        htmlLines.push("<ul>");
        inList = true;
        listType = "ul";
      }
      htmlLines.push(`<li>${checkbox} ${processInlineMarkdown(content)}</li>`);
      continue;
    }

    // Handle bullet lists
    if (bulletMatch) {
      if (!inList || listType !== "ul") {
        if (inList) htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
        htmlLines.push("<ul>");
        inList = true;
        listType = "ul";
      }
      htmlLines.push(`<li>${processInlineMarkdown(bulletMatch[1])}</li>`);
      continue;
    }

    // Handle numbered lists
    if (numberedMatch) {
      if (!inList || listType !== "ol") {
        if (inList) htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
        htmlLines.push("<ol>");
        inList = true;
        listType = "ol";
      }
      htmlLines.push(`<li>${processInlineMarkdown(numberedMatch[1])}</li>`);
      continue;
    }

    // Close any open list
    if (inList) {
      htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
      inList = false;
      listType = null;
    }

    // Handle headers
    const h3Match = line.match(/^###\s+(.*)$/);
    if (h3Match) {
      htmlLines.push(`<h3>${processInlineMarkdown(h3Match[1])}</h3>`);
      continue;
    }

    const h2Match = line.match(/^##\s+(.*)$/);
    if (h2Match) {
      htmlLines.push(`<h2>${processInlineMarkdown(h2Match[1])}</h2>`);
      continue;
    }

    const h1Match = line.match(/^#\s+(.*)$/);
    if (h1Match) {
      htmlLines.push(`<h1>${processInlineMarkdown(h1Match[1])}</h1>`);
      continue;
    }

    // Empty line becomes a paragraph break
    if (line.trim() === "") {
      htmlLines.push("<p></p>");
      continue;
    }

    // Regular paragraph
    htmlLines.push(`<p>${processInlineMarkdown(line)}</p>`);
  }

  // Close any remaining open list
  if (inList) {
    htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
  }

  return htmlLines.join("");
}

/**
 * Process inline markdown (bold, italic) within a line
 */
function processInlineMarkdown(text: string): string {
  let result = text;

  // Bold: **text** or *text* (single asterisk for bold in our simplified version)
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");

  // Italic: _text_
  result = result.replace(/_([^_]+)_/g, "<em>$1</em>");

  return result;
}

/**
 * Apply content template with variable substitution and markdown conversion
 */
export function applyContentTemplate(
  template: string | null | undefined,
  options: TemplateVariables = {}
): string {
  if (!template) return "";

  const variables = getTemplateVariables(
    options.date || new Date(),
    options.streamName || ""
  );

  // First replace variables
  const withVariables = replaceVariables(template, variables);

  // Then convert markdown to HTML
  return markdownToHtml(withVariables);
}

/**
 * Check if an entry should have templates applied
 * Templates apply when creating a new entry with empty title AND content
 */
export function shouldApplyTemplate(
  title: string | null | undefined,
  content: string | null | undefined
): boolean {
  const hasTitle = title && title.trim().length > 0;
  const hasContent = content && content.trim().length > 0;
  return !hasTitle && !hasContent;
}

/**
 * Template syntax help text for display in UI
 */
export const TEMPLATE_HELP = {
  variables: [
    { syntax: "{date}", description: "Full date (locale-aware)" },
    { syntax: "{date_short}", description: "Short date (locale-aware)" },
    { syntax: "{weekday}", description: "Day of week (Monday)" },
    { syntax: "{day}", description: "Day of month (6)" },
    { syntax: "{month}", description: "Month number (1)" },
    { syntax: "{month_name}", description: "Month name (January)" },
    { syntax: "{year}", description: "Full year (2026)" },
    { syntax: "{year_short}", description: "2-digit year (26)" },
    { syntax: "{stream}", description: "Stream name" },
    { syntax: "{time}", description: "Current time (locale-aware)" },
  ],
  markdown: [
    { syntax: "# Header", description: "Large heading" },
    { syntax: "## Header", description: "Medium heading" },
    { syntax: "### Header", description: "Small heading" },
    { syntax: "**bold** or *bold*", description: "Bold text" },
    { syntax: "_italic_", description: "Italic text" },
    { syntax: "- item", description: "Bullet point" },
    { syntax: "1. item", description: "Numbered list" },
    { syntax: "[ ]", description: "Unchecked checkbox" },
    { syntax: "[x]", description: "Checked checkbox" },
  ],
};
