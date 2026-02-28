import { describe, it, expect } from "vitest";
import { htmlToMarkdown, markdownToHtml } from "./entries";

// ============================================================================
// htmlToMarkdown — list handling
// ============================================================================

describe("htmlToMarkdown", () => {
  describe("flat bullet list", () => {
    it("converts simple bullet list", () => {
      const html = "<ul><li><p>Alpha</p></li><li><p>Beta</p></li></ul>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("- Alpha");
      expect(md).toContain("- Beta");
    });
  });

  describe("flat ordered list", () => {
    it("converts numbered list", () => {
      const html = "<ol><li><p>First</p></li><li><p>Second</p></li></ol>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("1. First");
      expect(md).toContain("2. Second");
    });
  });

  describe("flat task list", () => {
    it("converts unchecked task items", () => {
      const html = `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Todo item</p></div></li></ul>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain("- [ ] Todo item");
    });

    it("converts checked task items", () => {
      const html = `<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Done item</p></div></li></ul>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain("- [x] Done item");
    });

    it("converts mixed checked and unchecked", () => {
      const html = `<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Done</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Pending</p></div></li></ul>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain("- [x] Done");
      expect(md).toContain("- [ ] Pending");
    });
  });

  describe("nested bullet list (1 level)", () => {
    it("indents child items with 2 spaces", () => {
      const html = "<ul><li><p>Parent</p><ul><li><p>Child</p></li></ul></li></ul>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("- Parent");
      expect(md).toContain("  - Child");
    });
  });

  describe("nested bullet list (2 levels)", () => {
    it("indents grandchild items with 4 spaces", () => {
      const html = "<ul><li><p>A</p><ul><li><p>B</p><ul><li><p>C</p></li></ul></li></ul></li></ul>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("- A");
      expect(md).toContain("  - B");
      expect(md).toContain("    - C");
    });
  });

  describe("nested task list", () => {
    it("preserves nesting and check state", () => {
      const html = `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Parent task</p></div><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Child done</p></div></li></ul></li></ul>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain("- [ ] Parent task");
      expect(md).toContain("  - [x] Child done");
    });
  });

  describe("multiple siblings with nesting", () => {
    it("handles siblings where only some have children", () => {
      const html = "<ul><li><p>No kids</p></li><li><p>Has kids</p><ul><li><p>Kid 1</p></li><li><p>Kid 2</p></li></ul></li><li><p>Also no kids</p></li></ul>";
      const md = htmlToMarkdown(html);
      const lines = md.split("\n").filter((l) => l.trim());
      expect(lines).toEqual([
        "- No kids",
        "- Has kids",
        "  - Kid 1",
        "  - Kid 2",
        "- Also no kids",
      ]);
    });
  });

  describe("inline formatting in list items", () => {
    it("preserves bold and italic", () => {
      const html = "<ul><li><p><strong>Bold item</strong></p></li><li><p><em>Italic item</em></p></li></ul>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("- **Bold item**");
      expect(md).toContain("- *Italic item*");
    });

    it("preserves strikethrough", () => {
      const html = "<ul><li><p><s>Struck out</s></p></li></ul>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("- ~~Struck out~~");
    });

    it("preserves links", () => {
      const html = `<ul><li><p><a href="https://example.com">Link text</a></p></li></ul>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain("- [Link text](https://example.com)");
    });
  });

  describe("empty and edge cases", () => {
    it("returns empty string for empty input", () => {
      expect(htmlToMarkdown("")).toBe("");
    });

    it("handles list with empty items", () => {
      const html = "<ul><li><p></p></li></ul>";
      const md = htmlToMarkdown(html);
      expect(md).toContain("-");
    });
  });
});

// ============================================================================
// markdownToHtml — list handling
// ============================================================================

describe("markdownToHtml", () => {
  describe("flat bullet list", () => {
    it("wraps items in <ul><li>", () => {
      const md = "- Alpha\n- Beta";
      const html = markdownToHtml(md);
      expect(html).toContain("<ul>");
      expect(html).toContain("<li><p>Alpha</p></li>");
      expect(html).toContain("<li><p>Beta</p></li>");
      expect(html).toContain("</ul>");
    });
  });

  describe("flat ordered list", () => {
    it("wraps items in <ol><li>", () => {
      const md = "1. First\n2. Second";
      const html = markdownToHtml(md);
      expect(html).toContain("<ol>");
      expect(html).toContain("<li><p>First</p></li>");
      expect(html).toContain("<li><p>Second</p></li>");
      expect(html).toContain("</ol>");
    });
  });

  describe("flat task list", () => {
    it("creates unchecked task items", () => {
      const md = "- [ ] Todo";
      const html = markdownToHtml(md);
      expect(html).toContain('data-type="taskList"');
      expect(html).toContain('data-checked="false"');
      expect(html).toContain("Todo");
    });

    it("creates checked task items", () => {
      const md = "- [x] Done";
      const html = markdownToHtml(md);
      expect(html).toContain('data-checked="true"');
      expect(html).toContain('checked="checked"');
      expect(html).toContain("Done");
    });
  });

  describe("nested bullet list (1 level)", () => {
    it("nests child <ul> inside parent <li>", () => {
      const md = "- Parent\n  - Child";
      const html = markdownToHtml(md);
      // The child UL should be nested inside the parent LI
      expect(html).toContain("<ul>");
      expect(html).toMatch(/<li><p>Parent<\/p><ul><li><p>Child<\/p><\/li><\/ul><\/li>/);
    });
  });

  describe("nested bullet list (2 levels)", () => {
    it("nests grandchild correctly", () => {
      const md = "- A\n  - B\n    - C";
      const html = markdownToHtml(md);
      // Verify 3 levels of nesting exist
      expect(html).toContain("<li><p>A</p>");
      expect(html).toContain("<li><p>B</p>");
      expect(html).toContain("<li><p>C</p>");
      // Count the opening <ul> tags — should be 3 (outer + 2 nested)
      const ulCount = (html.match(/<ul>/g) || []).length;
      expect(ulCount).toBe(3);
    });
  });

  describe("nested task list", () => {
    it("nests task items with proper data attributes", () => {
      const md = "- [ ] Parent task\n  - [x] Child done";
      const html = markdownToHtml(md);
      expect(html).toContain('data-checked="false"');
      expect(html).toContain('data-checked="true"');
      // Should have nested taskList ULs
      const taskListCount = (html.match(/data-type="taskList"/g) || []).length;
      expect(taskListCount).toBe(2);
    });
  });

  describe("empty and edge cases", () => {
    it("returns empty string for empty input", () => {
      expect(markdownToHtml("")).toBe("");
    });
  });
});

// ============================================================================
// Round-trip: HTML → Markdown → HTML → Markdown
// ============================================================================

describe("round-trip conversion", () => {
  /**
   * Round-trip test helper: HTML → MD → HTML → MD
   * The second markdown should match the first markdown (stable conversion).
   */
  function assertStableRoundTrip(originalHtml: string) {
    const md1 = htmlToMarkdown(originalHtml);
    const html2 = markdownToHtml(md1);
    const md2 = htmlToMarkdown(html2);
    expect(md2).toBe(md1);
  }

  it("flat bullet list round-trips", () => {
    assertStableRoundTrip("<ul><li><p>Alpha</p></li><li><p>Beta</p></li></ul>");
  });

  it("flat ordered list round-trips", () => {
    assertStableRoundTrip("<ol><li><p>First</p></li><li><p>Second</p></li></ol>");
  });

  it("flat task list round-trips", () => {
    assertStableRoundTrip(
      `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Todo</p></div></li><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Done</p></div></li></ul>`
    );
  });

  it("nested bullet list (1 level) round-trips", () => {
    assertStableRoundTrip(
      "<ul><li><p>Parent</p><ul><li><p>Child 1</p></li><li><p>Child 2</p></li></ul></li></ul>"
    );
  });

  it("nested bullet list (2 levels) round-trips", () => {
    assertStableRoundTrip(
      "<ul><li><p>A</p><ul><li><p>B</p><ul><li><p>C</p></li></ul></li></ul></li></ul>"
    );
  });

  it("nested task list round-trips", () => {
    assertStableRoundTrip(
      `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Parent</p></div><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Child done</p></div></li></ul></li></ul>`
    );
  });

  it("siblings with mixed nesting round-trips", () => {
    assertStableRoundTrip(
      "<ul><li><p>Top</p></li><li><p>Has kids</p><ul><li><p>Kid</p></li></ul></li><li><p>Bottom</p></li></ul>"
    );
  });

  it("bold + italic in list items round-trips", () => {
    const html = "<ul><li><p><strong>Bold</strong> and <em>italic</em></p></li></ul>";
    const md1 = htmlToMarkdown(html);
    expect(md1).toContain("**Bold**");
    expect(md1).toContain("*italic*");
    const html2 = markdownToHtml(md1);
    const md2 = htmlToMarkdown(html2);
    expect(md2).toBe(md1);
  });

  it("strikethrough in list items round-trips", () => {
    const html = "<ul><li><p><s>Struck</s></p></li></ul>";
    const md1 = htmlToMarkdown(html);
    expect(md1).toContain("~~Struck~~");
    const html2 = markdownToHtml(md1);
    const md2 = htmlToMarkdown(html2);
    expect(md2).toBe(md1);
  });
});
