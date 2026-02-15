import { describe, it, expect } from "vitest";
import {
  splitTitleAndBody,
  combineTitleAndBody,
  extractTitle,
  extractBody,
  hasTitleStructure,
  stripEntryTitleFromContent,
} from "./editorHelpers";

// ============================================
// splitTitleAndBody TESTS
// ============================================

describe("splitTitleAndBody", () => {
  it("extracts title from h1.entry-title", () => {
    const html = '<h1 class="entry-title">My Title</h1><p>Body text</p>';
    const result = splitTitleAndBody(html);
    expect(result.title).toBe("My Title");
    expect(result.body).toBe("<p>Body text</p>");
  });

  it("handles empty html", () => {
    expect(splitTitleAndBody("")).toEqual({ title: "", body: "" });
    expect(splitTitleAndBody(null as any)).toEqual({ title: "", body: "" });
    expect(splitTitleAndBody(undefined as any)).toEqual({ title: "", body: "" });
  });

  it("handles html with no h1", () => {
    const html = "<p>Just a paragraph</p>";
    const result = splitTitleAndBody(html);
    expect(result.title).toBe("");
    expect(result.body).toBe("<p>Just a paragraph</p>");
  });

  it("strips HTML tags from title content", () => {
    const html = '<h1 class="entry-title"><strong>Bold</strong> Title</h1><p>Body</p>';
    const result = splitTitleAndBody(html);
    expect(result.title).toBe("Bold Title");
  });

  it("handles title with extra attributes", () => {
    const html = '<h1 class="entry-title custom-class" data-id="123">Title</h1><p>Body</p>';
    const result = splitTitleAndBody(html);
    expect(result.title).toBe("Title");
    expect(result.body).toBe("<p>Body</p>");
  });

  it("handles empty title", () => {
    const html = '<h1 class="entry-title"></h1><p>Body only</p>';
    const result = splitTitleAndBody(html);
    expect(result.title).toBe("");
    expect(result.body).toBe("<p>Body only</p>");
  });

  it("handles whitespace around html", () => {
    const html = '  <h1 class="entry-title">Title</h1><p>Body</p>  ';
    const result = splitTitleAndBody(html);
    expect(result.title).toBe("Title");
    expect(result.body).toBe("<p>Body</p>");
  });

  it("falls back to any h1 at start (legacy content)", () => {
    const html = "<h1>Legacy Title</h1><p>Body</p>";
    const result = splitTitleAndBody(html);
    expect(result.title).toBe("Legacy Title");
    expect(result.body).toBe("<p>Body</p>");
  });

  it("handles multiline title content", () => {
    const html = '<h1 class="entry-title">Title with\nnewline</h1><p>Body</p>';
    const result = splitTitleAndBody(html);
    expect(result.title).toBe("Title with\nnewline");
  });

  it("handles complex body content", () => {
    const html = '<h1 class="entry-title">Title</h1><p>Para 1</p><ul><li>Item</li></ul><p>Para 2</p>';
    const result = splitTitleAndBody(html);
    expect(result.title).toBe("Title");
    expect(result.body).toBe("<p>Para 1</p><ul><li>Item</li></ul><p>Para 2</p>");
  });
});

// ============================================
// combineTitleAndBody TESTS
// ============================================

describe("combineTitleAndBody", () => {
  it("combines title and body into html", () => {
    const result = combineTitleAndBody("My Title", "<p>Body text</p>");
    expect(result).toBe('<h1 class="entry-title">My Title</h1><p>Body text</p>');
  });

  it("handles empty title", () => {
    const result = combineTitleAndBody("", "<p>Body only</p>");
    expect(result).toBe('<h1 class="entry-title"></h1><p>Body only</p>');
  });

  it("handles empty body", () => {
    const result = combineTitleAndBody("Title only", "");
    expect(result).toBe('<h1 class="entry-title">Title only</h1><p></p>');
  });

  it("handles both empty", () => {
    const result = combineTitleAndBody("", "");
    expect(result).toBe('<h1 class="entry-title"></h1><p></p>');
  });

  it("escapes HTML entities in title", () => {
    const result = combineTitleAndBody("Title with <script> & \"quotes\"", "<p>Body</p>");
    expect(result).toBe('<h1 class="entry-title">Title with &lt;script&gt; &amp; "quotes"</h1><p>Body</p>');
  });

  it("strips duplicate h1.entry-title from body (prevents duplication)", () => {
    const result = combineTitleAndBody("Title", '<h1 class="entry-title">Old Title</h1><p>Body</p>');
    expect(result).toBe('<h1 class="entry-title">Title</h1><p>Body</p>');
  });

  it("does not strip regular h1 from body", () => {
    const result = combineTitleAndBody("Title", "<h1>Section Heading</h1><p>Body</p>");
    expect(result).toBe('<h1 class="entry-title">Title</h1><h1>Section Heading</h1><p>Body</p>');
  });

  it("handles null/undefined body", () => {
    const result = combineTitleAndBody("Title", null as any);
    expect(result).toBe('<h1 class="entry-title">Title</h1><p></p>');
  });
});

// ============================================
// extractTitle TESTS
// ============================================

describe("extractTitle", () => {
  it("extracts title from html", () => {
    const html = '<h1 class="entry-title">My Title</h1><p>Body</p>';
    expect(extractTitle(html)).toBe("My Title");
  });

  it("returns empty string for no title", () => {
    expect(extractTitle("<p>No title</p>")).toBe("");
    expect(extractTitle("")).toBe("");
  });
});

// ============================================
// extractBody TESTS
// ============================================

describe("extractBody", () => {
  it("extracts body from html", () => {
    const html = '<h1 class="entry-title">Title</h1><p>Body text</p>';
    expect(extractBody(html)).toBe("<p>Body text</p>");
  });

  it("returns entire content when no title", () => {
    expect(extractBody("<p>Just body</p>")).toBe("<p>Just body</p>");
  });

  it("returns empty string for empty html", () => {
    expect(extractBody("")).toBe("");
  });
});

// ============================================
// hasTitleStructure TESTS
// ============================================

describe("hasTitleStructure", () => {
  it("returns true for h1.entry-title at start", () => {
    expect(hasTitleStructure('<h1 class="entry-title">Title</h1><p>Body</p>')).toBe(true);
  });

  it("returns true for any h1 at start", () => {
    expect(hasTitleStructure("<h1>Title</h1><p>Body</p>")).toBe(true);
  });

  it("returns false for no h1 at start", () => {
    expect(hasTitleStructure("<p>No title</p>")).toBe(false);
    expect(hasTitleStructure("<div><h1>Nested</h1></div>")).toBe(false);
  });

  it("returns false for empty/null", () => {
    expect(hasTitleStructure("")).toBe(false);
    expect(hasTitleStructure(null as any)).toBe(false);
    expect(hasTitleStructure(undefined as any)).toBe(false);
  });

  it("handles whitespace before h1", () => {
    expect(hasTitleStructure("  <h1>Title</h1>")).toBe(true);
  });
});

// ============================================
// stripEntryTitleFromContent TESTS
// ============================================

describe("stripEntryTitleFromContent", () => {
  it("strips h1.entry-title from content start", () => {
    const html = '<h1 class="entry-title">Title</h1><p>Body text</p>';
    expect(stripEntryTitleFromContent(html)).toBe("<p>Body text</p>");
  });

  it("does NOT strip arbitrary h1 at start (preserves user headings)", () => {
    const html = "<h1>My Heading</h1><p>Body text</p>";
    expect(stripEntryTitleFromContent(html)).toBe("<h1>My Heading</h1><p>Body text</p>");
  });

  it("does NOT strip h1 with different class", () => {
    const html = '<h1 class="custom">Heading</h1><p>Body</p>';
    expect(stripEntryTitleFromContent(html)).toBe('<h1 class="custom">Heading</h1><p>Body</p>');
  });

  it("handles entry-title with extra classes", () => {
    const html = '<h1 class="entry-title extra-class">Title</h1><p>Body</p>';
    expect(stripEntryTitleFromContent(html)).toBe("<p>Body</p>");
  });

  it("handles empty/null input", () => {
    expect(stripEntryTitleFromContent("")).toBe("");
    expect(stripEntryTitleFromContent(null as any)).toBe("");
    expect(stripEntryTitleFromContent(undefined as any)).toBe("");
  });

  it("returns content unchanged when no h1 present", () => {
    expect(stripEntryTitleFromContent("<p>Just body</p>")).toBe("<p>Just body</p>");
  });

  it("handles content that is only an entry-title h1", () => {
    const html = '<h1 class="entry-title">Just a title</h1>';
    expect(stripEntryTitleFromContent(html)).toBe("");
  });

  it("handles whitespace around html", () => {
    const html = '  <h1 class="entry-title">Title</h1><p>Body</p>  ';
    expect(stripEntryTitleFromContent(html)).toBe("<p>Body</p>");
  });
});

// ============================================
// ROUNDTRIP TESTS
// ============================================

describe("roundtrip (split then combine)", () => {
  it("preserves content through split and combine", () => {
    const original = '<h1 class="entry-title">My Title</h1><p>Body content</p>';
    const { title, body } = splitTitleAndBody(original);
    const result = combineTitleAndBody(title, body);
    expect(result).toBe(original);
  });

  it("normalizes content without entry-title class", () => {
    const original = "<h1>Legacy Title</h1><p>Body</p>";
    const { title, body } = splitTitleAndBody(original);
    const result = combineTitleAndBody(title, body);
    // Result will have entry-title class added
    expect(result).toBe('<h1 class="entry-title">Legacy Title</h1><p>Body</p>');
  });

  it("preserves complex body content", () => {
    const original = '<h1 class="entry-title">Title</h1><ul><li>Item 1</li><li>Item 2</li></ul><p>End</p>';
    const { title, body } = splitTitleAndBody(original);
    const result = combineTitleAndBody(title, body);
    expect(result).toBe(original);
  });
});
