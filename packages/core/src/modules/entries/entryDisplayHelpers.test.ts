import { describe, it, expect } from "vitest";
import {
  getFirstLineOfText,
  formatSmashedContent,
  formatShortContent,
  formatFlowContent,
  getFormattedContent,
  getDisplayModeLines,
} from "./entryDisplayHelpers";

describe("entryDisplayHelpers", () => {
  describe("getFirstLineOfText", () => {
    it("extracts first line from simple HTML", () => {
      expect(getFirstLineOfText("<p>First line</p>")).toBe("First line");
    });

    it("handles multiple paragraphs", () => {
      const html = "<p>First line</p><p>Second line</p>";
      expect(getFirstLineOfText(html)).toBe("First line");
    });

    it("handles br tags", () => {
      const html = "First line<br>Second line";
      expect(getFirstLineOfText(html)).toBe("First line");
    });

    it("handles div tags", () => {
      const html = "<div>First line</div><div>Second line</div>";
      expect(getFirstLineOfText(html)).toBe("First line");
    });

    it("handles heading tags", () => {
      const html = "<h1>Heading</h1><p>Content</p>";
      expect(getFirstLineOfText(html)).toBe("Heading");
    });

    it("handles list items", () => {
      const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      expect(getFirstLineOfText(html)).toBe("Item 1");
    });

    it("decodes HTML entities", () => {
      expect(getFirstLineOfText("<p>Tom &amp; Jerry</p>")).toBe("Tom & Jerry");
      expect(getFirstLineOfText("<p>&lt;tag&gt;</p>")).toBe("<tag>");
      expect(getFirstLineOfText("<p>&quot;quoted&quot;</p>")).toBe('"quoted"');
      expect(getFirstLineOfText("<p>It&#039;s fine</p>")).toBe("It's fine");
      expect(getFirstLineOfText("<p>Non&nbsp;breaking</p>")).toBe("Non breaking");
    });

    it("skips empty lines", () => {
      const html = "<p></p><p>   </p><p>Actual content</p>";
      expect(getFirstLineOfText(html)).toBe("Actual content");
    });

    it("truncates long lines to 100 chars", () => {
      const longText = "a".repeat(150);
      const result = getFirstLineOfText(`<p>${longText}</p>`);
      expect(result.length).toBe(103); // 100 + "..."
      expect(result.endsWith("...")).toBe(true);
    });

    it("returns empty string for empty content", () => {
      expect(getFirstLineOfText("")).toBe("");
      expect(getFirstLineOfText("<p></p>")).toBe("");
    });
  });

  describe("formatSmashedContent", () => {
    it("strips HTML tags", () => {
      expect(formatSmashedContent("<p>Hello</p>")).toBe("Hello");
    });

    it("replaces block tags with spaces", () => {
      const html = "<p>First</p><p>Second</p>";
      expect(formatSmashedContent(html)).toBe("First Second");
    });

    it("handles br tags", () => {
      const html = "First<br>Second<br/>Third";
      expect(formatSmashedContent(html)).toBe("First Second Third");
    });

    it("normalizes whitespace", () => {
      const html = "<p>Too    many   spaces</p>";
      expect(formatSmashedContent(html)).toBe("Too many spaces");
    });

    it("decodes HTML entities", () => {
      expect(formatSmashedContent("<p>Tom &amp; Jerry</p>")).toBe("Tom & Jerry");
    });

    it("truncates to maxLength", () => {
      const longHtml = `<p>${"word ".repeat(50)}</p>`;
      const result = formatSmashedContent(longHtml, 50);
      expect(result.length).toBeLessThanOrEqual(53); // 50 + "..."
      expect(result.endsWith("...")).toBe(true);
    });

    it("uses default maxLength of 150", () => {
      const longHtml = `<p>${"word ".repeat(100)}</p>`;
      const result = formatSmashedContent(longHtml);
      expect(result.length).toBeLessThanOrEqual(153);
    });

    it("does not add ellipsis for short content", () => {
      expect(formatSmashedContent("<p>Short</p>")).toBe("Short");
    });
  });

  describe("formatShortContent", () => {
    it("preserves line breaks", () => {
      const html = "<p>Line 1</p><p>Line 2</p>";
      const result = formatShortContent(html);
      expect(result).toContain("Line 1");
      expect(result).toContain("Line 2");
    });

    it("limits to 5 lines", () => {
      const html = Array.from({ length: 10 }, (_, i) => `<p>Line ${i + 1}</p>`).join("");
      const result = formatShortContent(html);
      const lines = result.split("\n").filter((l) => l.trim());
      expect(lines.length).toBeLessThanOrEqual(6); // 5 + possible ellipsis line
    });

    it("adds ellipsis when truncated by lines", () => {
      const html = Array.from({ length: 10 }, (_, i) => `<p>Line ${i + 1}</p>`).join("");
      const result = formatShortContent(html);
      expect(result).toContain("...");
    });

    it("limits to 300 characters", () => {
      const longLine = "a".repeat(400);
      const result = formatShortContent(`<p>${longLine}</p>`);
      expect(result.length).toBeLessThanOrEqual(303);
    });
  });

  describe("formatFlowContent", () => {
    it("returns HTML as-is", () => {
      const html = "<p><strong>Bold</strong> and <em>italic</em></p>";
      expect(formatFlowContent(html)).toBe(html);
    });

    it("does not modify content", () => {
      const html = "<div><ul><li>Item</li></ul></div>";
      expect(formatFlowContent(html)).toBe(html);
    });
  });

  describe("getFormattedContent", () => {
    const testHtml = "<p>First line</p><p>Second line</p>";

    it("uses getFirstLineOfText for title mode", () => {
      const result = getFormattedContent(testHtml, "title");
      expect(result).toBe("First line");
    });

    it("uses formatSmashedContent for smashed mode", () => {
      const result = getFormattedContent(testHtml, "smashed");
      expect(result).toBe("First line Second line");
    });

    it("uses formatShortContent for short mode", () => {
      const result = getFormattedContent(testHtml, "short");
      expect(result).toContain("First line");
      expect(result).toContain("Second line");
    });

    it("uses formatFlowContent for flow mode", () => {
      const result = getFormattedContent(testHtml, "flow");
      expect(result).toBe(testHtml);
    });

    it("respects maxLength parameter for smashed mode", () => {
      const longHtml = `<p>${"word ".repeat(50)}</p>`;
      const result = getFormattedContent(longHtml, "smashed", 20);
      expect(result.length).toBeLessThanOrEqual(23);
    });

    it("defaults to smashed for unknown mode", () => {
      const result = getFormattedContent(testHtml, "unknown" as any);
      expect(result).toBe("First line Second line");
    });
  });

  describe("getDisplayModeLines", () => {
    it("returns 1 for title mode", () => {
      expect(getDisplayModeLines("title")).toBe(1);
    });

    it("returns 2 for smashed mode", () => {
      expect(getDisplayModeLines("smashed")).toBe(2);
    });

    it("returns 5 for short mode", () => {
      expect(getDisplayModeLines("short")).toBe(5);
    });

    it("returns undefined for flow mode", () => {
      expect(getDisplayModeLines("flow")).toBeUndefined();
    });

    it("returns 2 for unknown mode (default)", () => {
      expect(getDisplayModeLines("unknown" as any)).toBe(2);
    });
  });
});
