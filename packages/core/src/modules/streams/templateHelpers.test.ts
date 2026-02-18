import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getTemplateVariables,
  replaceVariables,
  applyTitleTemplate,
  markdownToHtml,
  applyContentTemplate,
  shouldApplyTemplate,
  TEMPLATE_HELP,
} from "./templateHelpers";

// ============================================
// TEMPLATE VARIABLES TESTS
// ============================================

describe("getTemplateVariables", () => {
  it("returns all expected keys", () => {
    const vars = getTemplateVariables();
    expect(vars).toHaveProperty("date");
    expect(vars).toHaveProperty("date_short");
    expect(vars).toHaveProperty("weekday");
    expect(vars).toHaveProperty("day");
    expect(vars).toHaveProperty("month");
    expect(vars).toHaveProperty("month_name");
    expect(vars).toHaveProperty("year");
    expect(vars).toHaveProperty("year_short");
    expect(vars).toHaveProperty("stream");
    expect(vars).toHaveProperty("time");
  });

  it("formats date correctly", () => {
    const date = new Date("2026-01-15T10:30:00");
    const vars = getTemplateVariables(date, "Test Stream");

    expect(vars.day).toBe("15");
    expect(vars.month).toBe("01");
    expect(vars.month_name).toBe("January");
    expect(vars.year).toBe("2026");
    expect(vars.year_short).toBe("26");
    expect(vars.weekday).toBe("Thursday");
  });

  it("formats time correctly", () => {
    const date = new Date("2026-01-15T10:30:00");
    const vars = getTemplateVariables(date);
    // Time format depends on locale, so just check it's not empty
    expect(vars.time.length).toBeGreaterThan(0);
  });

  it("zero-pads single-digit day and month", () => {
    const date = new Date(2026, 2, 3, 12, 0, 0); // March 3
    const vars = getTemplateVariables(date);
    expect(vars.day).toBe("03");
    expect(vars.month).toBe("03");
  });

  it("handles missing streamName", () => {
    const vars = getTemplateVariables(new Date());
    expect(vars.stream).toBe("");
  });

  it("includes stream name when provided", () => {
    const vars = getTemplateVariables(new Date(), "My Stream");
    expect(vars.stream).toBe("My Stream");
  });
});

// ============================================
// VARIABLE REPLACEMENT TESTS
// ============================================

describe("replaceVariables", () => {
  it("replaces {date} with value", () => {
    const result = replaceVariables("Today is {date}", { date: "January 15, 2026" });
    expect(result).toBe("Today is January 15, 2026");
  });

  it("replaces multiple variables", () => {
    const result = replaceVariables("{greeting} {name}!", { greeting: "Hello", name: "World" });
    expect(result).toBe("Hello World!");
  });

  it("case-insensitive replacement", () => {
    const result = replaceVariables("{DATE} and {Date} and {date}", { date: "today" });
    expect(result).toBe("today and today and today");
  });

  it("leaves unknown variables unchanged", () => {
    const result = replaceVariables("Hello {unknown}", { known: "value" });
    expect(result).toBe("Hello {unknown}");
  });

  it("handles empty template", () => {
    const result = replaceVariables("", { date: "today" });
    expect(result).toBe("");
  });

  it("handles empty variables", () => {
    const result = replaceVariables("Hello", {});
    expect(result).toBe("Hello");
  });
});

// ============================================
// TITLE TEMPLATE TESTS
// ============================================

describe("applyTitleTemplate", () => {
  it("applies variables to template", () => {
    // Use explicit time to avoid timezone issues
    const date = new Date(2026, 0, 15, 12, 0, 0);
    const result = applyTitleTemplate("Entry for {month_name} {day}", { date });
    expect(result).toBe("Entry for January 15");
  });

  it("handles null template", () => {
    expect(applyTitleTemplate(null)).toBe("");
  });

  it("handles empty template", () => {
    expect(applyTitleTemplate("")).toBe("");
  });

  it("handles undefined template", () => {
    expect(applyTitleTemplate(undefined)).toBe("");
  });

  it("zero-pads single-digit day in title template", () => {
    const date = new Date(2026, 0, 3, 12, 0, 0); // Jan 3
    const result = applyTitleTemplate("{year}-{month}-{day}", { date });
    expect(result).toBe("2026-01-03");
  });

  it("does not double-pad double-digit day and month", () => {
    const date = new Date(2026, 11, 25, 12, 0, 0); // Dec 25
    const result = applyTitleTemplate("{year}-{month}-{day}", { date });
    expect(result).toBe("2026-12-25");
  });

  it("includes stream name", () => {
    const result = applyTitleTemplate("{stream} - {day}", { streamName: "Journal" });
    expect(result).toContain("Journal");
  });
});

// ============================================
// MARKDOWN TO HTML TESTS
// ============================================

describe("markdownToHtml", () => {
  it("converts # to <h1>", () => {
    expect(markdownToHtml("# Header")).toBe("<h1>Header</h1>");
  });

  it("converts ## to <h2>", () => {
    expect(markdownToHtml("## Header")).toBe("<h2>Header</h2>");
  });

  it("converts ### to <h3>", () => {
    expect(markdownToHtml("### Header")).toBe("<h3>Header</h3>");
  });

  it("converts **bold** to <strong>", () => {
    expect(markdownToHtml("**bold text**")).toBe("<p><strong>bold text</strong></p>");
  });

  it("converts *bold* to <strong>", () => {
    expect(markdownToHtml("*bold text*")).toBe("<p><strong>bold text</strong></p>");
  });

  it("converts _italic_ to <em>", () => {
    expect(markdownToHtml("_italic text_")).toBe("<p><em>italic text</em></p>");
  });

  it("converts - bullets to <ul><li>", () => {
    const result = markdownToHtml("- Item 1\n- Item 2");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>Item 1</li>");
    expect(result).toContain("<li>Item 2</li>");
    expect(result).toContain("</ul>");
  });

  it("converts numbered list to <ol><li>", () => {
    const result = markdownToHtml("1. First\n2. Second");
    expect(result).toContain("<ol>");
    expect(result).toContain("<li>First</li>");
    expect(result).toContain("<li>Second</li>");
    expect(result).toContain("</ol>");
  });

  it("converts [ ] to unchecked checkbox", () => {
    const result = markdownToHtml("[ ] Unchecked item");
    expect(result).toContain("☐");
    expect(result).toContain("<li>");
  });

  it("converts [x] to checked checkbox", () => {
    const result = markdownToHtml("[x] Checked item");
    expect(result).toContain("☑");
  });

  it("converts [X] to checked checkbox (uppercase)", () => {
    const result = markdownToHtml("[X] Checked item");
    expect(result).toContain("☑");
  });

  it("handles mixed content", () => {
    const markdown = `# Title

**Bold** and _italic_

- Bullet 1
- Bullet 2`;
    const result = markdownToHtml(markdown);
    expect(result).toContain("<h1>Title</h1>");
    expect(result).toContain("<strong>Bold</strong>");
    expect(result).toContain("<em>italic</em>");
    expect(result).toContain("<ul>");
  });

  it("handles empty lines as paragraph breaks", () => {
    const result = markdownToHtml("Line 1\n\nLine 2");
    expect(result).toContain("<p></p>");
  });

  it("closes lists when switching types", () => {
    const result = markdownToHtml("- Bullet\n1. Number");
    expect(result).toContain("</ul>");
    expect(result).toContain("<ol>");
  });
});

// ============================================
// CONTENT TEMPLATE TESTS
// ============================================

describe("applyContentTemplate", () => {
  it("applies variables first", () => {
    // Use explicit time to avoid timezone issues
    const date = new Date(2026, 0, 15, 12, 0, 0);
    const result = applyContentTemplate("Date: {day}", { date });
    expect(result).toContain("15");
  });

  it("converts markdown second", () => {
    const result = applyContentTemplate("# Header with {stream}", { streamName: "Test" });
    expect(result).toBe("<h1>Header with Test</h1>");
  });

  it("handles null template", () => {
    expect(applyContentTemplate(null)).toBe("");
  });

  it("handles complex template", () => {
    const template = `# {stream} Entry

**Date:** {date}

[ ] Task 1
[ ] Task 2`;
    const result = applyContentTemplate(template, {
      streamName: "Daily",
      date: new Date(2026, 0, 15, 12, 0, 0)
    });

    expect(result).toContain("<h1>Daily Entry</h1>");
    expect(result).toContain("☐");
  });
});

// ============================================
// SHOULD APPLY TEMPLATE TESTS
// ============================================

describe("shouldApplyTemplate", () => {
  it("returns true when both empty", () => {
    expect(shouldApplyTemplate("", "")).toBe(true);
    expect(shouldApplyTemplate(null, null)).toBe(true);
    expect(shouldApplyTemplate(undefined, undefined)).toBe(true);
  });

  it("returns true when whitespace only", () => {
    expect(shouldApplyTemplate("   ", "   ")).toBe(true);
  });

  it("returns false when title present", () => {
    expect(shouldApplyTemplate("Title", "")).toBe(false);
  });

  it("returns false when content present", () => {
    expect(shouldApplyTemplate("", "Content")).toBe(false);
  });

  it("returns false when both present", () => {
    expect(shouldApplyTemplate("Title", "Content")).toBe(false);
  });
});

// ============================================
// TEMPLATE HELP CONSTANT TESTS
// ============================================

describe("TEMPLATE_HELP", () => {
  it("has variables array", () => {
    expect(Array.isArray(TEMPLATE_HELP.variables)).toBe(true);
    expect(TEMPLATE_HELP.variables.length).toBeGreaterThan(0);
  });

  it("has markdown array", () => {
    expect(Array.isArray(TEMPLATE_HELP.markdown)).toBe(true);
    expect(TEMPLATE_HELP.markdown.length).toBeGreaterThan(0);
  });

  it("variables have syntax and description", () => {
    TEMPLATE_HELP.variables.forEach((v) => {
      expect(v).toHaveProperty("syntax");
      expect(v).toHaveProperty("description");
    });
  });

  it("markdown items have syntax and description", () => {
    TEMPLATE_HELP.markdown.forEach((m) => {
      expect(m).toHaveProperty("syntax");
      expect(m).toHaveProperty("description");
    });
  });
});
