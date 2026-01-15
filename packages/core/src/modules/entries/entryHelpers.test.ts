import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseHashtags,
  parseMentions,
  extractTagsAndMentions,
  stripHtml,
  getWordCount,
  getCharacterCount,
  getPreviewText,
  formatRelativeTime,
  formatEntryDate,
  formatEntryDateTime,
  formatEntryDateOnly,
  isActionableStatus,
  isCompletedStatus,
  getNextStatus,
  isTask,
  isTaskOverdue,
  isDueToday,
  isDueThisWeek,
  formatDueDate,
  getTaskStats,
  validateTypeName,
  sortTypes,
  isLegacyType,
  isTypeFeatureAvailable,
  aggregateTags,
  aggregateMentions,
  aggregateLocations,
  getEntryCounts,
  MAX_TYPE_NAME_LENGTH,
  buildLocationTree,
  getLocationTreeTotalCount,
} from "./entryHelpers";
import type { LocationHierarchyRow } from "./EntryTypes";

// ============================================
// PARSING TESTS
// ============================================

describe("parseHashtags", () => {
  it("extracts single tag", () => {
    expect(parseHashtags("Hello #world")).toEqual(["world"]);
  });

  it("extracts multiple tags", () => {
    expect(parseHashtags("#hello #world #test")).toEqual(["hello", "world", "test"]);
  });

  it("deduplicates tags", () => {
    expect(parseHashtags("#hello #HELLO #Hello")).toEqual(["hello"]);
  });

  it("normalizes to lowercase", () => {
    expect(parseHashtags("#UPPERCASE")).toEqual(["uppercase"]);
  });

  it("handles empty content", () => {
    expect(parseHashtags("")).toEqual([]);
  });

  it("handles content with no tags", () => {
    expect(parseHashtags("Just plain text")).toEqual([]);
  });

  it("handles tags with numbers and underscores", () => {
    expect(parseHashtags("#tag_123 #test2")).toEqual(["tag_123", "test2"]);
  });
});

describe("parseMentions", () => {
  it("extracts single mention", () => {
    expect(parseMentions("Hello @john")).toEqual(["john"]);
  });

  it("extracts multiple mentions", () => {
    expect(parseMentions("@alice @bob @charlie")).toEqual(["alice", "bob", "charlie"]);
  });

  it("deduplicates mentions", () => {
    expect(parseMentions("@john @JOHN @John")).toEqual(["john"]);
  });

  it("normalizes to lowercase", () => {
    expect(parseMentions("@UPPERCASE")).toEqual(["uppercase"]);
  });

  it("handles empty content", () => {
    expect(parseMentions("")).toEqual([]);
  });

  it("handles content with no mentions", () => {
    expect(parseMentions("Just plain text")).toEqual([]);
  });
});

describe("extractTagsAndMentions", () => {
  it("extracts both tags and mentions", () => {
    const result = extractTagsAndMentions("Hello #world @john");
    expect(result.tags).toEqual(["world"]);
    expect(result.mentions).toEqual(["john"]);
  });

  it("handles empty content", () => {
    const result = extractTagsAndMentions("");
    expect(result.tags).toEqual([]);
    expect(result.mentions).toEqual([]);
  });
});

// ============================================
// HTML PROCESSING TESTS
// ============================================

describe("stripHtml", () => {
  it("removes basic tags", () => {
    expect(stripHtml("<p>Hello</p>")).toBe("Hello");
  });

  it("preserves text content", () => {
    expect(stripHtml("<strong>Bold</strong> text")).toBe("Bold text");
  });

  it("adds newlines for block elements", () => {
    const result = stripHtml("<p>First</p><p>Second</p>");
    expect(result).toContain("First");
    expect(result).toContain("Second");
  });

  it("decodes HTML entities", () => {
    expect(stripHtml("&amp; &lt; &gt; &quot; &#039;")).toBe("& < > \" '");
  });

  it("handles nested tags", () => {
    expect(stripHtml("<div><p><strong>Nested</strong></p></div>")).toContain("Nested");
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });

  it("handles br tags", () => {
    expect(stripHtml("Line1<br>Line2")).toContain("Line1");
    expect(stripHtml("Line1<br/>Line2")).toContain("Line2");
  });

  it("decodes nbsp", () => {
    expect(stripHtml("Hello&nbsp;World")).toBe("Hello World");
  });
});

describe("getWordCount", () => {
  it("counts words in plain text", () => {
    expect(getWordCount("Hello world")).toBe(2);
  });

  it("strips HTML before counting", () => {
    expect(getWordCount("<p>Hello</p> <p>world</p>")).toBe(2);
  });

  it("returns 0 for empty content", () => {
    expect(getWordCount("")).toBe(0);
  });

  it("handles multiple spaces", () => {
    expect(getWordCount("Hello    world")).toBe(2);
  });
});

describe("getCharacterCount", () => {
  it("counts characters in plain text", () => {
    expect(getCharacterCount("Hello")).toBe(5);
  });

  it("strips HTML before counting", () => {
    expect(getCharacterCount("<p>Hello</p>")).toBe(5);
  });

  it("returns 0 for empty content", () => {
    expect(getCharacterCount("")).toBe(0);
  });
});

describe("getPreviewText", () => {
  it("truncates long content", () => {
    const longText = "A".repeat(200);
    const result = getPreviewText(longText, 100);
    expect(result.length).toBe(103); // 100 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("adds ellipsis", () => {
    const result = getPreviewText("A".repeat(200), 50);
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns full content if under limit", () => {
    const shortText = "Short text";
    expect(getPreviewText(shortText, 100)).toBe(shortText);
  });

  it("strips HTML", () => {
    expect(getPreviewText("<p>Hello</p>", 100)).toBe("Hello");
  });
});

// ============================================
// STATUS LOGIC TESTS
// ============================================

describe("isActionableStatus", () => {
  it("returns true for actionable statuses", () => {
    expect(isActionableStatus("new")).toBe(true);
    expect(isActionableStatus("todo")).toBe(true);
    expect(isActionableStatus("in_progress")).toBe(true);
    expect(isActionableStatus("in_review")).toBe(true);
    expect(isActionableStatus("waiting")).toBe(true);
    expect(isActionableStatus("on_hold")).toBe(true);
  });

  it("returns false for completed statuses", () => {
    expect(isActionableStatus("done")).toBe(false);
    expect(isActionableStatus("closed")).toBe(false);
    expect(isActionableStatus("cancelled")).toBe(false);
  });

  it("returns false for none status", () => {
    expect(isActionableStatus("none")).toBe(false);
  });
});

describe("isCompletedStatus", () => {
  it("returns true for completed statuses", () => {
    expect(isCompletedStatus("done")).toBe(true);
    expect(isCompletedStatus("closed")).toBe(true);
    expect(isCompletedStatus("cancelled")).toBe(true);
  });

  it("returns false for actionable statuses", () => {
    expect(isCompletedStatus("new")).toBe(false);
    expect(isCompletedStatus("todo")).toBe(false);
    expect(isCompletedStatus("in_progress")).toBe(false);
  });

  it("returns false for none status", () => {
    expect(isCompletedStatus("none")).toBe(false);
  });
});

describe("getNextStatus", () => {
  it("returns none for none", () => {
    expect(getNextStatus("none")).toBe("none");
  });

  it("returns done for actionable statuses", () => {
    expect(getNextStatus("todo")).toBe("done");
    expect(getNextStatus("in_progress")).toBe("done");
    expect(getNextStatus("new")).toBe("done");
  });

  it("returns todo for completed statuses", () => {
    expect(getNextStatus("done")).toBe("todo");
    expect(getNextStatus("closed")).toBe("todo");
    expect(getNextStatus("cancelled")).toBe("todo");
  });
});

describe("isTask", () => {
  it("returns true for any status except none", () => {
    expect(isTask("todo")).toBe(true);
    expect(isTask("done")).toBe(true);
    expect(isTask("in_progress")).toBe(true);
  });

  it("returns false for none status", () => {
    expect(isTask("none")).toBe(false);
  });
});

// ============================================
// DUE DATE LOGIC TESTS
// ============================================

describe("isTaskOverdue", () => {
  it("returns true when actionable and past due", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isTaskOverdue("todo", yesterday.toISOString())).toBe(true);
  });

  it("returns false when completed", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isTaskOverdue("done", yesterday.toISOString())).toBe(false);
  });

  it("returns false when no due date", () => {
    expect(isTaskOverdue("todo", null)).toBe(false);
  });

  it("returns false when future due date", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isTaskOverdue("todo", tomorrow.toISOString())).toBe(false);
  });

  it("returns false for today", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    expect(isTaskOverdue("todo", today.toISOString())).toBe(false);
  });
});

describe("isDueToday", () => {
  it("returns true for today", () => {
    const today = new Date();
    expect(isDueToday(today.toISOString())).toBe(true);
  });

  it("returns false for other days", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isDueToday(tomorrow.toISOString())).toBe(false);
  });

  it("returns false for null", () => {
    expect(isDueToday(null)).toBe(false);
  });
});

describe("isDueThisWeek", () => {
  it("returns true for dates within 7 days", () => {
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    expect(isDueThisWeek(inThreeDays.toISOString())).toBe(true);
  });

  it("returns false for dates beyond 7 days", () => {
    const inTenDays = new Date();
    inTenDays.setDate(inTenDays.getDate() + 10);
    expect(isDueThisWeek(inTenDays.toISOString())).toBe(false);
  });

  it("returns true for today", () => {
    expect(isDueThisWeek(new Date().toISOString())).toBe(true);
  });

  it("returns false for null", () => {
    expect(isDueThisWeek(null)).toBe(false);
  });
});

describe("formatDueDate", () => {
  it("formats Today for today", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    expect(formatDueDate(today.toISOString(), "todo")).toBe("Today");
  });

  it("formats Tomorrow for tomorrow", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    expect(formatDueDate(tomorrow.toISOString(), "todo")).toBe("Tomorrow");
  });

  it("formats Overdue for actionable past due", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const result = formatDueDate(yesterday.toISOString(), "todo");
    expect(result).toContain("Overdue");
  });

  it("does not show overdue for completed tasks", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const result = formatDueDate(yesterday.toISOString(), "done");
    expect(result).not.toContain("Overdue");
  });

  it("returns empty string for null", () => {
    expect(formatDueDate(null, "todo")).toBe("");
  });
});

// ============================================
// TYPE HELPERS TESTS
// ============================================

describe("validateTypeName", () => {
  it("rejects empty name", () => {
    const result = validateTypeName("");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("rejects name over max length", () => {
    const result = validateTypeName("A".repeat(MAX_TYPE_NAME_LENGTH + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toContain(`${MAX_TYPE_NAME_LENGTH}`);
  });

  it("accepts valid names", () => {
    expect(validateTypeName("Task").valid).toBe(true);
    expect(validateTypeName("Bug Report").valid).toBe(true);
  });

  it("trims whitespace", () => {
    expect(validateTypeName("  Valid  ").valid).toBe(true);
  });
});

describe("sortTypes", () => {
  it("sorts alphabetically case-insensitive", () => {
    const types = ["Zebra", "apple", "Banana"];
    expect(sortTypes(types)).toEqual(["apple", "Banana", "Zebra"]);
  });

  it("does not mutate original array", () => {
    const types = ["c", "b", "a"];
    sortTypes(types);
    expect(types).toEqual(["c", "b", "a"]);
  });
});

describe("isLegacyType", () => {
  it("detects types not in allowed list", () => {
    expect(isLegacyType("Old Type", ["New Type"])).toBe(true);
  });

  it("returns false for allowed types", () => {
    expect(isLegacyType("Allowed", ["Allowed", "Other"])).toBe(false);
  });

  it("returns false for null type", () => {
    expect(isLegacyType(null, ["Type"])).toBe(false);
  });
});

describe("isTypeFeatureAvailable", () => {
  it("requires both enabled AND types defined", () => {
    expect(isTypeFeatureAvailable(true, ["Type"])).toBe(true);
    expect(isTypeFeatureAvailable(true, [])).toBe(false);
    expect(isTypeFeatureAvailable(false, ["Type"])).toBe(false);
    expect(isTypeFeatureAvailable(undefined, ["Type"])).toBe(false);
    expect(isTypeFeatureAvailable(true, undefined)).toBe(false);
  });
});

// ============================================
// AGGREGATION TESTS
// ============================================

describe("aggregateTags", () => {
  it("counts tag occurrences", () => {
    const entries = [
      { tags: ["work", "urgent"] },
      { tags: ["work", "meeting"] },
      { tags: ["urgent"] },
    ];
    const result = aggregateTags(entries);
    expect(result.find((t) => t.tag === "work")?.count).toBe(2);
    expect(result.find((t) => t.tag === "urgent")?.count).toBe(2);
    expect(result.find((t) => t.tag === "meeting")?.count).toBe(1);
  });

  it("sorts by count descending", () => {
    const entries = [
      { tags: ["rare"] },
      { tags: ["common", "rare"] },
      { tags: ["common"] },
      { tags: ["common"] },
    ];
    const result = aggregateTags(entries);
    expect(result[0].tag).toBe("common");
    expect(result[0].count).toBe(3);
  });

  it("handles empty/null tags", () => {
    const entries = [{ tags: null }, { tags: [] }, { tags: ["tag"] }];
    const result = aggregateTags(entries);
    expect(result.length).toBe(1);
    expect(result[0].tag).toBe("tag");
  });
});

describe("aggregateMentions", () => {
  it("counts mention occurrences", () => {
    const entries = [
      { mentions: ["john", "jane"] },
      { mentions: ["john"] },
    ];
    const result = aggregateMentions(entries);
    expect(result.find((m) => m.mention === "john")?.count).toBe(2);
    expect(result.find((m) => m.mention === "jane")?.count).toBe(1);
  });

  it("sorts by count descending", () => {
    const entries = [
      { mentions: ["alice"] },
      { mentions: ["bob", "alice"] },
      { mentions: ["bob"] },
      { mentions: ["bob"] },
    ];
    const result = aggregateMentions(entries);
    expect(result[0].mention).toBe("bob");
  });
});

describe("aggregateLocations", () => {
  it("counts location occurrences", () => {
    const entries = [
      { location_id: "loc1" },
      { location_id: "loc1" },
      { location_id: "loc2" },
    ];
    const result = aggregateLocations(entries);
    expect(result.find((l) => l.location_id === "loc1")?.count).toBe(2);
  });

  it("ignores null location_id", () => {
    const entries = [
      { location_id: null },
      { location_id: "loc1" },
    ];
    const result = aggregateLocations(entries);
    expect(result.length).toBe(1);
  });
});

describe("getEntryCounts", () => {
  it("returns total and noStream counts", () => {
    const entries = [
      { stream_id: "stream1" },
      { stream_id: null },
      { stream_id: "stream2" },
      { stream_id: null },
    ];
    const result = getEntryCounts(entries);
    expect(result.total).toBe(4);
    expect(result.noStream).toBe(2);
  });

  it("handles empty array", () => {
    const result = getEntryCounts([]);
    expect(result.total).toBe(0);
    expect(result.noStream).toBe(0);
  });
});

// ============================================
// TASK STATS TESTS
// ============================================

describe("getTaskStats", () => {
  it("calculates correct stats", () => {
    const entries = [
      { status: "todo" as const },
      { status: "in_progress" as const },
      { status: "done" as const },
      { status: "none" as const },
    ];
    const result = getTaskStats(entries);
    expect(result.total).toBe(3); // none is not a task
    expect(result.actionable).toBe(2);
    expect(result.inProgress).toBe(1);
    expect(result.completed).toBe(1);
  });

  it("handles empty array", () => {
    const result = getTaskStats([]);
    expect(result.total).toBe(0);
    expect(result.actionable).toBe(0);
    expect(result.inProgress).toBe(0);
    expect(result.completed).toBe(0);
  });
});

// ============================================
// DATE FORMATTING TESTS (time-sensitive)
// ============================================

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-14T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for very recent", () => {
    const now = new Date("2026-01-14T11:59:30Z");
    expect(formatRelativeTime(now.toISOString())).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinutesAgo = new Date("2026-01-14T11:55:00Z");
    expect(formatRelativeTime(fiveMinutesAgo.toISOString())).toBe("5 minutes ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date("2026-01-14T09:00:00Z");
    expect(formatRelativeTime(threeHoursAgo.toISOString())).toBe("3 hours ago");
  });

  it("returns yesterday", () => {
    const yesterday = new Date("2026-01-13T12:00:00Z");
    expect(formatRelativeTime(yesterday.toISOString())).toBe("yesterday");
  });

  it("returns days ago for recent dates", () => {
    const threeDaysAgo = new Date("2026-01-11T12:00:00Z");
    expect(formatRelativeTime(threeDaysAgo.toISOString())).toBe("3 days ago");
  });
});

describe("formatEntryDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-14T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes 'Last edited' prefix", () => {
    const now = new Date("2026-01-14T11:59:00Z");
    const result = formatEntryDate(now.toISOString());
    expect(result).toContain("Last edited");
  });
});

// ============================================
// LOCATION HIERARCHY TESTS
// ============================================

describe("buildLocationTree", () => {
  it("builds empty tree from empty rows", () => {
    const result = buildLocationTree([], 0);
    expect(result).toEqual([]);
  });

  it("builds single country node", () => {
    const rows: LocationHierarchyRow[] = [
      { country: "United States", region: null, city: null, place_name: null, entry_count: 5 },
    ];
    const result = buildLocationTree(rows);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("country");
    expect(result[0].value).toBe("United States");
    expect(result[0].entryCount).toBe(5);
  });

  it("builds full hierarchy", () => {
    const rows: LocationHierarchyRow[] = [
      { country: "United States", region: "Missouri", city: "Kansas City", place_name: "Home", entry_count: 10 },
      { country: "United States", region: "Missouri", city: "Kansas City", place_name: "Work", entry_count: 5 },
      { country: "United States", region: "Missouri", city: "St. Louis", place_name: null, entry_count: 3 },
    ];
    const result = buildLocationTree(rows);

    // Should have 1 country
    expect(result.length).toBe(1);
    expect(result[0].value).toBe("United States");
    expect(result[0].entryCount).toBe(18); // 10 + 5 + 3

    // Should have 1 region under country
    const regions = result[0].children;
    expect(regions.length).toBe(1);
    expect(regions[0].value).toBe("Missouri");
    expect(regions[0].entryCount).toBe(18);

    // Should have 2 cities under region
    const cities = regions[0].children;
    expect(cities.length).toBe(2);

    // Kansas City should be first (more entries)
    expect(cities[0].value).toBe("Kansas City");
    expect(cities[0].entryCount).toBe(15);

    // St. Louis second
    expect(cities[1].value).toBe("St. Louis");
    expect(cities[1].entryCount).toBe(3);

    // Kansas City should have 2 places
    expect(cities[0].children.length).toBe(2);
    expect(cities[0].children[0].value).toBe("Home"); // 10 entries, first
    expect(cities[0].children[1].value).toBe("Work"); // 5 entries, second
  });

  it("handles multiple countries", () => {
    const rows: LocationHierarchyRow[] = [
      { country: "United States", region: "Missouri", city: null, place_name: null, entry_count: 10 },
      { country: "Canada", region: "Ontario", city: null, place_name: null, entry_count: 5 },
    ];
    const result = buildLocationTree(rows);

    expect(result.length).toBe(2);
    // US first (more entries)
    expect(result[0].value).toBe("United States");
    expect(result[1].value).toBe("Canada");
  });

  it("adds No Location node when noLocationCount > 0", () => {
    const rows: LocationHierarchyRow[] = [
      { country: "United States", region: null, city: null, place_name: null, entry_count: 5 },
    ];
    const result = buildLocationTree(rows, 10);

    expect(result.length).toBe(2);
    expect(result[1].type).toBe("no_location");
    expect(result[1].displayName).toBe("No Location");
    expect(result[1].entryCount).toBe(10);
  });

  it("skips rows with no location data", () => {
    const rows: LocationHierarchyRow[] = [
      { country: null, region: null, city: null, place_name: null, entry_count: 5 },
      { country: "United States", region: null, city: null, place_name: null, entry_count: 3 },
    ];
    const result = buildLocationTree(rows);

    expect(result.length).toBe(1);
    expect(result[0].value).toBe("United States");
    expect(result[0].entryCount).toBe(3);
  });

  it("handles place without city (attached to region)", () => {
    const rows: LocationHierarchyRow[] = [
      { country: "United States", region: "Missouri", city: null, place_name: "State Capitol", entry_count: 2 },
    ];
    const result = buildLocationTree(rows);

    expect(result[0].children[0].children.length).toBe(1);
    expect(result[0].children[0].children[0].type).toBe("place");
    expect(result[0].children[0].children[0].value).toBe("State Capitol");
  });

  it("handles city without region (attached to country)", () => {
    const rows: LocationHierarchyRow[] = [
      { country: "United States", region: null, city: "Washington D.C.", place_name: null, entry_count: 5 },
    ];
    const result = buildLocationTree(rows);

    expect(result[0].children.length).toBe(1);
    expect(result[0].children[0].type).toBe("city");
    expect(result[0].children[0].value).toBe("Washington D.C.");
  });

  it("includes parent references in nodes", () => {
    const rows: LocationHierarchyRow[] = [
      { country: "United States", region: "Missouri", city: "Kansas City", place_name: "Home", entry_count: 1 },
    ];
    const result = buildLocationTree(rows);

    const placeNode = result[0].children[0].children[0].children[0];
    expect(placeNode.parentCity).toBe("Kansas City");
    expect(placeNode.parentRegion).toBe("Missouri");
    expect(placeNode.parentCountry).toBe("United States");
  });

  it("sorts children by entry count descending", () => {
    const rows: LocationHierarchyRow[] = [
      { country: "United States", region: "California", city: null, place_name: null, entry_count: 5 },
      { country: "United States", region: "Texas", city: null, place_name: null, entry_count: 20 },
      { country: "United States", region: "Missouri", city: null, place_name: null, entry_count: 10 },
    ];
    const result = buildLocationTree(rows);

    const regions = result[0].children;
    expect(regions[0].value).toBe("Texas"); // 20
    expect(regions[1].value).toBe("Missouri"); // 10
    expect(regions[2].value).toBe("California"); // 5
  });
});

describe("getLocationTreeTotalCount", () => {
  it("returns 0 for empty tree", () => {
    expect(getLocationTreeTotalCount([])).toBe(0);
  });

  it("counts leaf nodes correctly", () => {
    const rows: LocationHierarchyRow[] = [
      { country: "United States", region: "Missouri", city: "Kansas City", place_name: "Home", entry_count: 10 },
      { country: "United States", region: "Missouri", city: "Kansas City", place_name: "Work", entry_count: 5 },
    ];
    const tree = buildLocationTree(rows);
    // Total should be 15 (from leaf nodes)
    expect(getLocationTreeTotalCount(tree)).toBe(15);
  });

  it("includes no location count", () => {
    const rows: LocationHierarchyRow[] = [
      { country: "United States", region: null, city: null, place_name: null, entry_count: 5 },
    ];
    const tree = buildLocationTree(rows, 10);
    // Tree has US with 5 entries and No Location with 10
    expect(getLocationTreeTotalCount(tree)).toBe(15);
  });
});
