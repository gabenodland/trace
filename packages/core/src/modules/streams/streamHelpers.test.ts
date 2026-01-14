import { describe, it, expect } from "vitest";
import {
  normalizeStreamName,
  displayStreamName,
  filterStreamsByQuery,
  sortStreamsByName,
  sortStreamsByCount,
  getTotalEntryCount,
  getStreamAttributeVisibility,
} from "./streamHelpers";
import type { Stream } from "./StreamTypes";

// Helper to create mock stream
const createStream = (overrides: Partial<Stream> = {}): Stream => ({
  stream_id: "test-stream-id",
  user_id: "test-user-id",
  name: "Test Stream",
  entry_count: 0,
  stream_order: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  synced: 1,
  sync_action: null,
  ...overrides,
});

describe("streamHelpers", () => {
  describe("normalizeStreamName", () => {
    it("converts to lowercase", () => {
      expect(normalizeStreamName("My Stream")).toBe("my stream");
    });

    it("trims whitespace", () => {
      expect(normalizeStreamName("  my stream  ")).toBe("my stream");
    });

    it("replaces multiple spaces with single space", () => {
      expect(normalizeStreamName("my   stream   name")).toBe("my stream name");
    });

    it("handles empty string", () => {
      expect(normalizeStreamName("")).toBe("");
    });
  });

  describe("displayStreamName", () => {
    it("capitalizes first letter of each word", () => {
      expect(displayStreamName("my stream")).toBe("My Stream");
    });

    it("handles already capitalized text", () => {
      expect(displayStreamName("My Stream")).toBe("My Stream");
    });

    it("handles single word", () => {
      expect(displayStreamName("stream")).toBe("Stream");
    });

    it("handles empty string", () => {
      expect(displayStreamName("")).toBe("");
    });
  });

  describe("filterStreamsByQuery", () => {
    const streams = [
      createStream({ stream_id: "1", name: "Work Tasks" }),
      createStream({ stream_id: "2", name: "Personal Notes" }),
      createStream({ stream_id: "3", name: "Daily Journal" }),
    ];

    it("returns all streams for empty query", () => {
      expect(filterStreamsByQuery(streams, "")).toHaveLength(3);
    });

    it("returns all streams for whitespace-only query", () => {
      expect(filterStreamsByQuery(streams, "   ")).toHaveLength(3);
    });

    it("filters by partial name match", () => {
      const result = filterStreamsByQuery(streams, "task");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Work Tasks");
    });

    it("is case-insensitive", () => {
      const result = filterStreamsByQuery(streams, "PERSONAL");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Personal Notes");
    });

    it("returns empty array when no match", () => {
      expect(filterStreamsByQuery(streams, "xyz")).toHaveLength(0);
    });

    it("matches multiple streams", () => {
      const result = filterStreamsByQuery(streams, "a");
      expect(result.length).toBeGreaterThan(1);
    });
  });

  describe("sortStreamsByName", () => {
    const streams = [
      createStream({ stream_id: "1", name: "Zebra" }),
      createStream({ stream_id: "2", name: "Apple" }),
      createStream({ stream_id: "3", name: "Mango" }),
    ];

    it("sorts alphabetically", () => {
      const sorted = sortStreamsByName(streams);
      expect(sorted[0].name).toBe("Apple");
      expect(sorted[1].name).toBe("Mango");
      expect(sorted[2].name).toBe("Zebra");
    });

    it("does not mutate original array", () => {
      const original = [...streams];
      sortStreamsByName(streams);
      expect(streams[0].name).toBe(original[0].name);
    });

    it("handles empty array", () => {
      expect(sortStreamsByName([])).toEqual([]);
    });
  });

  describe("sortStreamsByCount", () => {
    const streams = [
      createStream({ stream_id: "1", name: "Low", entry_count: 5 }),
      createStream({ stream_id: "2", name: "High", entry_count: 100 }),
      createStream({ stream_id: "3", name: "Medium", entry_count: 50 }),
    ];

    it("sorts by entry count descending", () => {
      const sorted = sortStreamsByCount(streams);
      expect(sorted[0].entry_count).toBe(100);
      expect(sorted[1].entry_count).toBe(50);
      expect(sorted[2].entry_count).toBe(5);
    });

    it("does not mutate original array", () => {
      const original = [...streams];
      sortStreamsByCount(streams);
      expect(streams[0].entry_count).toBe(original[0].entry_count);
    });
  });

  describe("getTotalEntryCount", () => {
    it("sums all entry counts", () => {
      const streams = [
        createStream({ entry_count: 10 }),
        createStream({ entry_count: 20 }),
        createStream({ entry_count: 30 }),
      ];
      expect(getTotalEntryCount(streams)).toBe(60);
    });

    it("returns 0 for empty array", () => {
      expect(getTotalEntryCount([])).toBe(0);
    });

    it("handles streams with 0 entries", () => {
      const streams = [
        createStream({ entry_count: 0 }),
        createStream({ entry_count: 5 }),
      ];
      expect(getTotalEntryCount(streams)).toBe(5);
    });
  });

  describe("getStreamAttributeVisibility", () => {
    describe("when no stream provided", () => {
      it("returns default visibility settings", () => {
        const visibility = getStreamAttributeVisibility(null);
        expect(visibility.showStatus).toBe(true);
        expect(visibility.showType).toBe(false);
        expect(visibility.showDueDate).toBe(true);
        expect(visibility.showRating).toBe(true);
        expect(visibility.showPriority).toBe(true);
        expect(visibility.showLocation).toBe(true);
        expect(visibility.showPhotos).toBe(true);
        expect(visibility.availableTypes).toEqual([]);
        expect(visibility.ratingType).toBe("stars");
      });

      it("handles undefined", () => {
        const visibility = getStreamAttributeVisibility(undefined);
        expect(visibility.showStatus).toBe(true);
      });
    });

    describe("when stream provided", () => {
      it("respects entry_use_status setting", () => {
        const streamWithStatus = createStream({ entry_use_status: true });
        const streamWithoutStatus = createStream({ entry_use_status: false });

        expect(getStreamAttributeVisibility(streamWithStatus).showStatus).toBe(true);
        expect(getStreamAttributeVisibility(streamWithoutStatus).showStatus).toBe(false);
      });

      it("shows type only when enabled and types defined", () => {
        const streamWithTypes = createStream({
          entry_use_type: true,
          entry_types: ["note", "task"],
        });
        const streamNoTypes = createStream({
          entry_use_type: true,
          entry_types: [],
        });
        const streamDisabled = createStream({
          entry_use_type: false,
          entry_types: ["note"],
        });

        expect(getStreamAttributeVisibility(streamWithTypes).showType).toBe(true);
        expect(getStreamAttributeVisibility(streamNoTypes).showType).toBe(false);
        expect(getStreamAttributeVisibility(streamDisabled).showType).toBe(false);
      });

      it("respects entry_use_duedates setting", () => {
        const streamWith = createStream({ entry_use_duedates: true });
        const streamWithout = createStream({ entry_use_duedates: false });

        expect(getStreamAttributeVisibility(streamWith).showDueDate).toBe(true);
        expect(getStreamAttributeVisibility(streamWithout).showDueDate).toBe(false);
      });

      it("respects entry_use_rating setting", () => {
        const streamWith = createStream({ entry_use_rating: true });
        const streamWithout = createStream({ entry_use_rating: false });

        expect(getStreamAttributeVisibility(streamWith).showRating).toBe(true);
        expect(getStreamAttributeVisibility(streamWithout).showRating).toBe(false);
      });

      it("respects entry_use_priority setting", () => {
        const streamWith = createStream({ entry_use_priority: true });
        const streamWithout = createStream({ entry_use_priority: false });

        expect(getStreamAttributeVisibility(streamWith).showPriority).toBe(true);
        expect(getStreamAttributeVisibility(streamWithout).showPriority).toBe(false);
      });

      it("respects entry_use_location setting (default true)", () => {
        const streamWith = createStream({ entry_use_location: true });
        const streamWithout = createStream({ entry_use_location: false });
        const streamDefault = createStream({});

        expect(getStreamAttributeVisibility(streamWith).showLocation).toBe(true);
        expect(getStreamAttributeVisibility(streamWithout).showLocation).toBe(false);
        expect(getStreamAttributeVisibility(streamDefault).showLocation).toBe(true);
      });

      it("respects entry_use_photos setting (default true)", () => {
        const streamWith = createStream({ entry_use_photos: true });
        const streamWithout = createStream({ entry_use_photos: false });
        const streamDefault = createStream({});

        expect(getStreamAttributeVisibility(streamWith).showPhotos).toBe(true);
        expect(getStreamAttributeVisibility(streamWithout).showPhotos).toBe(false);
        expect(getStreamAttributeVisibility(streamDefault).showPhotos).toBe(true);
      });

      it("returns available types from stream", () => {
        const stream = createStream({
          entry_use_type: true,
          entry_types: ["note", "task", "event"],
        });
        expect(getStreamAttributeVisibility(stream).availableTypes).toEqual([
          "note",
          "task",
          "event",
        ]);
      });

      it("returns rating type from stream", () => {
        const streamStars = createStream({ entry_rating_type: "stars" });
        const streamDecimal = createStream({ entry_rating_type: "decimal" });

        expect(getStreamAttributeVisibility(streamStars).ratingType).toBe("stars");
        expect(getStreamAttributeVisibility(streamDecimal).ratingType).toBe("decimal");
      });

      it("defaults rating type to stars", () => {
        const stream = createStream({});
        expect(getStreamAttributeVisibility(stream).ratingType).toBe("stars");
      });
    });
  });
});
