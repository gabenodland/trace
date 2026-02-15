import { describe, it, expect } from "vitest";
import {
  sortEntries,
  groupEntriesByStatus,
  groupEntriesByType,
  groupEntriesByStream,
  groupEntriesByPriority,
  groupEntriesByRating,
  groupEntriesByDueDate,
  groupEntries,
  filterEntriesBySearch,
  getRatingLabel,
  type EntrySection,
} from "./entrySortHelpers";
import type { Entry, BaseEntry } from "./EntryTypes";

// Helper to create mock entry
const createEntry = (overrides: Partial<Entry> = {}): Entry => ({
  entry_id: "test-entry-id",
  user_id: "test-user-id",
  stream_id: null,
  title: "",
  content: "<p>Test content</p>",
  entry_date: "2024-01-15",
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-01-15T10:00:00Z",
  status: "none",
  priority: 0,
  rating: 0,
  due_date: null,
  type: null,
  is_pinned: false,
  tags: [],
  mentions: [],
  synced: 1,
  sync_action: null,
  version: 1,
  ...overrides,
});

describe("entrySortHelpers", () => {
  describe("sortEntries", () => {
    describe("by title", () => {
      const entries = [
        createEntry({ entry_id: "1", title: "Zebra" }),
        createEntry({ entry_id: "2", title: "Apple" }),
        createEntry({ entry_id: "3", title: "Mango" }),
      ];

      it("sorts alphabetically ascending", () => {
        const sorted = sortEntries(entries, "title", undefined, "asc");
        expect(sorted[0].title).toBe("Apple");
        expect(sorted[1].title).toBe("Mango");
        expect(sorted[2].title).toBe("Zebra");
      });

      it("sorts alphabetically descending", () => {
        const sorted = sortEntries(entries, "title", undefined, "desc");
        expect(sorted[0].title).toBe("Zebra");
        expect(sorted[2].title).toBe("Apple");
      });

      it("uses content as fallback when no title", () => {
        const entriesNoTitle = [
          createEntry({ entry_id: "1", title: "", content: "<p>Beta</p>" }),
          createEntry({ entry_id: "2", title: "", content: "<p>Alpha</p>" }),
        ];
        const sorted = sortEntries(entriesNoTitle, "title", undefined, "asc");
        expect(sorted[0].content).toContain("Alpha");
      });
    });

    describe("by entry_date", () => {
      const entries = [
        createEntry({ entry_id: "1", entry_date: "2024-01-01" }),
        createEntry({ entry_id: "2", entry_date: "2024-01-15" }),
        createEntry({ entry_id: "3", entry_date: "2024-01-10" }),
      ];

      it("sorts newest first (desc)", () => {
        const sorted = sortEntries(entries, "entry_date", undefined, "desc");
        expect(sorted[0].entry_date).toBe("2024-01-15");
        expect(sorted[2].entry_date).toBe("2024-01-01");
      });

      it("sorts oldest first (asc)", () => {
        const sorted = sortEntries(entries, "entry_date", undefined, "asc");
        expect(sorted[0].entry_date).toBe("2024-01-01");
        expect(sorted[2].entry_date).toBe("2024-01-15");
      });
    });

    describe("by priority", () => {
      const entries = [
        createEntry({ entry_id: "1", priority: 1 }),
        createEntry({ entry_id: "2", priority: 3 }),
        createEntry({ entry_id: "3", priority: 2 }),
      ];

      it("sorts highest priority first (desc)", () => {
        const sorted = sortEntries(entries, "priority", undefined, "desc");
        expect(sorted[0].priority).toBe(3);
        expect(sorted[2].priority).toBe(1);
      });

      it("sorts lowest priority first (asc)", () => {
        const sorted = sortEntries(entries, "priority", undefined, "asc");
        expect(sorted[0].priority).toBe(1);
        expect(sorted[2].priority).toBe(3);
      });
    });

    describe("by rating", () => {
      const entries = [
        createEntry({ entry_id: "1", rating: 5 }),
        createEntry({ entry_id: "2", rating: 10 }),
        createEntry({ entry_id: "3", rating: 0 }),
      ];

      it("sorts highest rating first (desc)", () => {
        const sorted = sortEntries(entries, "rating", undefined, "desc");
        expect(sorted[0].rating).toBe(10);
        expect(sorted[2].rating).toBe(0);
      });
    });

    describe("by status", () => {
      const entries = [
        createEntry({ entry_id: "1", status: "done" }),
        createEntry({ entry_id: "2", status: "new" }),
        createEntry({ entry_id: "3", status: "in_progress" }),
      ];

      it("sorts by workflow order", () => {
        const sorted = sortEntries(entries, "status", undefined, "desc");
        expect(sorted[0].status).toBe("new");
        expect(sorted[1].status).toBe("in_progress");
        expect(sorted[2].status).toBe("done");
      });
    });

    describe("by due_date", () => {
      const entries = [
        createEntry({ entry_id: "1", due_date: null }),
        createEntry({ entry_id: "2", due_date: "2024-01-20" }),
        createEntry({ entry_id: "3", due_date: "2024-01-10" }),
      ];

      it("puts entries without due date last", () => {
        const sorted = sortEntries(entries, "due_date", undefined, "asc");
        expect(sorted[2].due_date).toBeNull();
      });

      it("sorts by date when present", () => {
        const sorted = sortEntries(entries, "due_date", undefined, "asc");
        // With "asc" order, the multiplier inverts, so later dates come first (before null)
        expect(sorted[0].due_date).toBe("2024-01-20");
        expect(sorted[1].due_date).toBe("2024-01-10");
      });
    });

    describe("pinned entries", () => {
      const entries = [
        createEntry({ entry_id: "1", title: "Normal", is_pinned: false }),
        createEntry({ entry_id: "2", title: "Pinned", is_pinned: true }),
      ];

      it("puts pinned first when showPinnedFirst is true", () => {
        const sorted = sortEntries(entries, "title", undefined, "asc", true);
        expect(sorted[0].is_pinned).toBe(true);
      });

      it("ignores pinned when showPinnedFirst is false", () => {
        const sorted = sortEntries(entries, "title", undefined, "asc", false);
        expect(sorted[0].title).toBe("Normal");
      });
    });

    describe("by stream", () => {
      const streamMap = { stream1: "Alpha", stream2: "Beta" };
      const entries = [
        createEntry({ entry_id: "1", stream_id: "stream2" }),
        createEntry({ entry_id: "2", stream_id: "stream1" }),
        createEntry({ entry_id: "3", stream_id: null }),
      ];

      it("sorts by stream name", () => {
        const sorted = sortEntries(entries, "stream", streamMap, "asc");
        // Entries without stream (empty string) come first alphabetically
        expect(sorted[0].stream_id).toBeNull();
        expect(sorted[1].stream_id).toBe("stream1"); // Alpha
        expect(sorted[2].stream_id).toBe("stream2"); // Beta
      });
    });
  });

  describe("groupEntriesByStatus", () => {
    const entries = [
      createEntry({ entry_id: "1", status: "todo" }),
      createEntry({ entry_id: "2", status: "done" }),
      createEntry({ entry_id: "3", status: "todo" }),
      createEntry({ entry_id: "4", status: "in_progress" }),
    ];

    it("groups entries by status", () => {
      const sections = groupEntriesByStatus(entries);
      expect(sections.length).toBeGreaterThan(0);
    });

    it("creates section with correct count", () => {
      const sections = groupEntriesByStatus(entries);
      const todoSection = sections.find((s) => s.title === "To Do");
      expect(todoSection?.count).toBe(2);
    });

    it("uses workflow order for sections", () => {
      const sections = groupEntriesByStatus(entries, "desc");
      const titles = sections.map((s) => s.title);
      // "To Do" should come before "Done" in workflow order
      expect(titles.indexOf("To Do")).toBeGreaterThanOrEqual(0);
      expect(titles.indexOf("To Do")).toBeLessThan(titles.indexOf("Done"));
    });
  });

  describe("groupEntriesByType", () => {
    const entries = [
      createEntry({ entry_id: "1", type: "note" }),
      createEntry({ entry_id: "2", type: "task" }),
      createEntry({ entry_id: "3", type: "note" }),
      createEntry({ entry_id: "4", type: null }),
    ];

    it("groups entries by type", () => {
      const sections = groupEntriesByType(entries);
      expect(sections.length).toBeGreaterThan(0);
    });

    it("labels entries without type as 'No Type'", () => {
      const sections = groupEntriesByType(entries);
      const noTypeSection = sections.find((s) => s.title === "No Type");
      expect(noTypeSection?.count).toBe(1);
    });
  });

  describe("groupEntriesByStream", () => {
    const streamMap = { stream1: "Work", stream2: "Personal" };
    const entries = [
      createEntry({ entry_id: "1", stream_id: "stream1" }),
      createEntry({ entry_id: "2", stream_id: "stream2" }),
      createEntry({ entry_id: "3", stream_id: null }),
    ];

    it("groups entries by stream name", () => {
      const sections = groupEntriesByStream(entries, streamMap);
      expect(sections.length).toBeGreaterThan(0);
    });

    it("labels entries without stream as 'No Stream'", () => {
      const sections = groupEntriesByStream(entries, streamMap);
      const noStreamSection = sections.find((s) => s.title === "No Stream");
      expect(noStreamSection?.count).toBe(1);
    });
  });

  describe("groupEntriesByPriority", () => {
    const entries = [
      createEntry({ entry_id: "1", priority: 3 }),
      createEntry({ entry_id: "2", priority: 0 }),
      createEntry({ entry_id: "3", priority: 1 }),
    ];

    it("separates entries with and without priority", () => {
      const sections = groupEntriesByPriority(entries);
      expect(sections.length).toBe(2);
    });

    it("labels entries without priority as 'No Priority'", () => {
      const sections = groupEntriesByPriority(entries);
      const noSection = sections.find((s) => s.title === "No Priority");
      expect(noSection?.count).toBe(1);
    });
  });

  describe("groupEntriesByRating", () => {
    const entries = [
      createEntry({ entry_id: "1", rating: 10 }),
      createEntry({ entry_id: "2", rating: 6 }),
      createEntry({ entry_id: "3", rating: 0 }),
    ];

    it("groups entries by rating", () => {
      const sections = groupEntriesByRating(entries);
      expect(sections.length).toBeGreaterThan(0);
    });

    it("labels entries without rating as 'No Rating'", () => {
      const sections = groupEntriesByRating(entries);
      const noSection = sections.find((s) => s.title === "No Rating");
      expect(noSection?.count).toBe(1);
    });
  });

  describe("groupEntries", () => {
    const entries = [
      createEntry({ entry_id: "1", status: "todo" }),
      createEntry({ entry_id: "2", status: "done" }),
    ];

    it("routes to status grouping", () => {
      const sections = groupEntries(entries, "status");
      expect(sections.length).toBeGreaterThan(0);
    });

    it("returns single section for 'none' mode", () => {
      const sections = groupEntries(entries, "none");
      expect(sections.length).toBe(1);
      expect(sections[0].count).toBe(2);
    });
  });

  describe("filterEntriesBySearch", () => {
    const entries = [
      createEntry({ entry_id: "1", title: "Meeting Notes", content: "<p>Discuss project</p>" }),
      createEntry({ entry_id: "2", title: "Shopping List", content: "<p>Buy groceries</p>" }),
      createEntry({ entry_id: "3", title: "Ideas", content: "<p>Meeting ideas</p>", tags: ["meeting"] }),
    ];

    it("returns all entries for empty query", () => {
      expect(filterEntriesBySearch(entries, "")).toHaveLength(3);
    });

    it("returns all entries for whitespace query", () => {
      expect(filterEntriesBySearch(entries, "   ")).toHaveLength(3);
    });

    it("searches in title", () => {
      const result = filterEntriesBySearch(entries, "meeting");
      expect(result.some((e) => e.title === "Meeting Notes")).toBe(true);
    });

    it("searches in content (strips HTML)", () => {
      const result = filterEntriesBySearch(entries, "groceries");
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Shopping List");
    });

    it("searches in tags", () => {
      const result = filterEntriesBySearch(entries, "meeting");
      expect(result.some((e) => e.tags?.includes("meeting"))).toBe(true);
    });

    it("is case-insensitive", () => {
      const result = filterEntriesBySearch(entries, "MEETING");
      expect(result.length).toBeGreaterThan(0);
    });

    it("decodes HTML entities in content", () => {
      const entriesWithEntities = [
        createEntry({ entry_id: "1", content: "<p>Tom &amp; Jerry</p>" }),
      ];
      const result = filterEntriesBySearch(entriesWithEntities, "tom & jerry");
      expect(result).toHaveLength(1);
    });

    it("searches in type", () => {
      const entriesWithType = [
        createEntry({ entry_id: "1", type: "note" }),
        createEntry({ entry_id: "2", type: "task" }),
      ];
      const result = filterEntriesBySearch(entriesWithType, "note");
      expect(result).toHaveLength(1);
    });
  });

  describe("getRatingLabel", () => {
    describe("stars mode", () => {
      it("returns 'No Rating' for 0", () => {
        expect(getRatingLabel(0, "stars")).toBe("No Rating");
      });

      it("returns singular '1 Star'", () => {
        expect(getRatingLabel(2, "stars")).toBe("1 Star");
      });

      it("returns plural 'X Stars'", () => {
        expect(getRatingLabel(6, "stars")).toBe("3 Stars");
        expect(getRatingLabel(10, "stars")).toBe("5 Stars");
      });
    });

    describe("10base mode", () => {
      it("returns 'No Rating' for 0", () => {
        expect(getRatingLabel(0, "10base")).toBe("No Rating");
      });

      it("returns whole number format", () => {
        expect(getRatingLabel(7, "10base")).toBe("7/10");
      });

      it("returns decimal format for non-whole", () => {
        expect(getRatingLabel(7.5, "10base")).toBe("7.5/10");
      });
    });
  });

  describe("pinned section in grouped modes", () => {
    const entries = [
      createEntry({ entry_id: "1", type: "bug", status: "todo", is_pinned: true, entry_date: "2024-01-15" }),
      createEntry({ entry_id: "2", type: "bug", status: "todo", is_pinned: false, entry_date: "2024-01-14" }),
      createEntry({ entry_id: "3", type: "feature", status: "done", is_pinned: true, entry_date: "2024-01-10" }),
      createEntry({ entry_id: "4", type: "feature", status: "done", is_pinned: false, entry_date: "2024-01-13" }),
    ];

    it("groupEntriesByType creates Pinned section at top when showPinnedFirst is true", () => {
      const sections = groupEntriesByType(entries, "desc", true);
      expect(sections[0].title).toBe("Pinned");
      expect(sections[0].count).toBe(2);
      expect(sections[0].data.every((e) => e.is_pinned)).toBe(true);
    });

    it("groupEntriesByType excludes pinned entries from type groups", () => {
      const sections = groupEntriesByType(entries, "desc", true);
      const nonPinnedSections = sections.filter((s) => s.title !== "Pinned");
      for (const section of nonPinnedSections) {
        expect(section.data.every((e) => !e.is_pinned)).toBe(true);
      }
    });

    it("groupEntriesByType has no Pinned section when showPinnedFirst is false", () => {
      const sections = groupEntriesByType(entries, "desc", false);
      expect(sections.find((s) => s.title === "Pinned")).toBeUndefined();
    });

    it("groupEntriesByType has no Pinned section when no entries are pinned", () => {
      const unpinned = entries.map((e) => ({ ...e, is_pinned: false }));
      const sections = groupEntriesByType(unpinned, "desc", true);
      expect(sections.find((s) => s.title === "Pinned")).toBeUndefined();
    });

    it("groupEntriesByStatus creates Pinned section at top", () => {
      const sections = groupEntriesByStatus(entries, "desc", true);
      expect(sections[0].title).toBe("Pinned");
      expect(sections[0].count).toBe(2);
    });

    it("groupEntriesByStream creates Pinned section at top", () => {
      const streamEntries = [
        createEntry({ entry_id: "1", stream_id: "s1", is_pinned: true }),
        createEntry({ entry_id: "2", stream_id: "s1", is_pinned: false }),
        createEntry({ entry_id: "3", stream_id: "s2", is_pinned: false }),
      ];
      const streamMap = { s1: "Work", s2: "Personal" };
      const sections = groupEntriesByStream(streamEntries, streamMap, "desc", true);
      expect(sections[0].title).toBe("Pinned");
      expect(sections[0].count).toBe(1);
    });

    it("groupEntriesByPriority creates Pinned section at top", () => {
      const priorityEntries = [
        createEntry({ entry_id: "1", priority: 3, is_pinned: true }),
        createEntry({ entry_id: "2", priority: 1, is_pinned: false }),
        createEntry({ entry_id: "3", priority: 0, is_pinned: false }),
      ];
      const sections = groupEntriesByPriority(priorityEntries, "desc", true);
      expect(sections[0].title).toBe("Pinned");
      expect(sections[0].count).toBe(1);
    });

    it("groupEntriesByRating creates Pinned section at top", () => {
      const ratingEntries = [
        createEntry({ entry_id: "1", rating: 8, is_pinned: true }),
        createEntry({ entry_id: "2", rating: 6, is_pinned: false }),
        createEntry({ entry_id: "3", rating: 0, is_pinned: false }),
      ];
      const sections = groupEntriesByRating(ratingEntries, "desc", true);
      expect(sections[0].title).toBe("Pinned");
      expect(sections[0].count).toBe(1);
    });

    it("groupEntriesByDueDate creates Pinned section at top", () => {
      const dueDateEntries = [
        createEntry({ entry_id: "1", due_date: "2024-12-01", is_pinned: true }),
        createEntry({ entry_id: "2", due_date: "2024-12-01", is_pinned: false }),
        createEntry({ entry_id: "3", due_date: null, is_pinned: false }),
      ];
      const sections = groupEntriesByDueDate(dueDateEntries, "desc", true);
      expect(sections[0].title).toBe("Pinned");
      expect(sections[0].count).toBe(1);
    });

    it("pinned section entries are sorted by date (newest first)", () => {
      const sections = groupEntriesByType(entries, "desc", true);
      const pinnedSection = sections[0];
      expect(pinnedSection.title).toBe("Pinned");
      // entry_id "1" has date 2024-01-15, entry_id "3" has date 2024-01-10
      expect(pinnedSection.data[0].entry_id).toBe("1");
      expect(pinnedSection.data[1].entry_id).toBe("3");
    });

    it("groupEntries dispatcher forwards showPinnedFirst", () => {
      const sections = groupEntries(entries, "status", undefined, "desc", true);
      expect(sections[0].title).toBe("Pinned");
      expect(sections[0].count).toBe(2);
    });

    it("total entry count is preserved across all sections", () => {
      const sections = groupEntriesByType(entries, "desc", true);
      const totalCount = sections.reduce((sum, s) => sum + s.data.length, 0);
      expect(totalCount).toBe(entries.length);
    });

    it("handles all entries pinned", () => {
      const allPinned = entries.map((e) => ({ ...e, is_pinned: true }));
      const sections = groupEntriesByType(allPinned, "desc", true);
      expect(sections.length).toBe(1);
      expect(sections[0].title).toBe("Pinned");
      expect(sections[0].count).toBe(allPinned.length);
    });
  });

  describe("generic type support", () => {
    // Simulates EntryWithRelations: extends BaseEntry with different attachments type
    interface TestEntrySubtype extends BaseEntry {
      attachments: { id: string; url: string }[];
      stream?: { name: string };
    }

    const createSubtypeEntry = (overrides: Partial<TestEntrySubtype> = {}): TestEntrySubtype => ({
      entry_id: "test-entry-id",
      user_id: "test-user-id",
      stream_id: null,
      title: "",
      content: "<p>Test content</p>",
      entry_date: "2024-01-15",
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
      status: "none",
      priority: 0,
      rating: 0,
      due_date: null,
      completed_at: null,
      type: null,
      is_pinned: false,
      is_archived: false,
      tags: [],
      mentions: [],
      entry_latitude: null,
      entry_longitude: null,
      location_radius: null,
      location_id: null,
      place_name: null,
      address: null,
      neighborhood: null,
      postal_code: null,
      city: null,
      subdivision: null,
      region: null,
      country: null,
      attachments: [],
      ...overrides,
    });

    it("sortEntries preserves subtype in return value", () => {
      const entries: TestEntrySubtype[] = [
        createSubtypeEntry({ entry_id: "1", title: "Zebra", attachments: [{ id: "a1", url: "/a1.jpg" }] }),
        createSubtypeEntry({ entry_id: "2", title: "Apple" }),
      ];

      const sorted = sortEntries(entries, "title", undefined, "asc");

      // Return type is TestEntrySubtype[], not Entry[]
      expect(sorted[0].title).toBe("Apple");
      expect(sorted[1].title).toBe("Zebra");
      // Subtype-specific field is preserved
      expect(sorted[1].attachments).toEqual([{ id: "a1", url: "/a1.jpg" }]);
    });

    it("groupEntriesByStatus returns sections with subtype data", () => {
      const entries: TestEntrySubtype[] = [
        createSubtypeEntry({ entry_id: "1", status: "todo", stream: { name: "Work" } }),
        createSubtypeEntry({ entry_id: "2", status: "done" }),
      ];

      const sections: EntrySection<TestEntrySubtype>[] = groupEntriesByStatus(entries);

      expect(sections.length).toBeGreaterThan(0);
      // Data in sections retains subtype fields
      const todoSection = sections.find(s => s.title === "To Do");
      expect(todoSection?.data[0]?.stream?.name).toBe("Work");
    });

    it("groupEntries routes correctly with subtype", () => {
      const entries: TestEntrySubtype[] = [
        createSubtypeEntry({ entry_id: "1", status: "todo" }),
        createSubtypeEntry({ entry_id: "2", status: "done" }),
      ];

      const sections = groupEntries(entries, "status");
      expect(sections.length).toBeGreaterThan(0);
      // Each section's data is TestEntrySubtype[]
      for (const section of sections) {
        for (const entry of section.data) {
          expect(entry).toHaveProperty("attachments");
        }
      }
    });

    it("filterEntriesBySearch preserves subtype", () => {
      const entries: TestEntrySubtype[] = [
        createSubtypeEntry({ entry_id: "1", title: "Meeting Notes", attachments: [{ id: "a1", url: "/photo.jpg" }] }),
        createSubtypeEntry({ entry_id: "2", title: "Shopping List" }),
      ];

      const filtered = filterEntriesBySearch(entries, "meeting");

      expect(filtered).toHaveLength(1);
      // Subtype field preserved
      expect(filtered[0].attachments).toEqual([{ id: "a1", url: "/photo.jpg" }]);
    });
  });
});
