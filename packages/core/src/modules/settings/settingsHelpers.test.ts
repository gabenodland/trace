import { describe, it, expect } from "vitest";
import {
  formatDistanceWithUnits,
  formatDistanceVerbose,
  mergeWithDefaults,
} from "./settingsHelpers";

describe("settingsHelpers", () => {
  describe("formatDistanceWithUnits", () => {
    describe("metric", () => {
      it("formats small distances in meters", () => {
        expect(formatDistanceWithUnits(50, "metric")).toBe("50m");
      });

      it("formats distances under 1km in meters", () => {
        expect(formatDistanceWithUnits(999, "metric")).toBe("999m");
      });

      it("formats 1km exactly", () => {
        expect(formatDistanceWithUnits(1000, "metric")).toBe("1.0km");
      });

      it("formats large distances in kilometers", () => {
        expect(formatDistanceWithUnits(5500, "metric")).toBe("5.5km");
      });

      it("rounds meters to nearest whole number", () => {
        expect(formatDistanceWithUnits(123.7, "metric")).toBe("124m");
      });
    });

    describe("imperial", () => {
      it("formats small distances in feet", () => {
        expect(formatDistanceWithUnits(10, "imperial")).toBe("33ft");
      });

      it("formats distances under 1000ft in feet", () => {
        expect(formatDistanceWithUnits(300, "imperial")).toBe("984ft");
      });

      it("formats large distances in miles", () => {
        expect(formatDistanceWithUnits(1609.34, "imperial")).toBe("1.0mi");
      });

      it("formats multi-mile distances", () => {
        expect(formatDistanceWithUnits(8046.7, "imperial")).toBe("5.0mi");
      });
    });

    describe("invalid inputs", () => {
      it("returns dash for negative distance", () => {
        expect(formatDistanceWithUnits(-100, "metric")).toBe("—");
      });

      it("returns dash for NaN", () => {
        expect(formatDistanceWithUnits(NaN, "metric")).toBe("—");
      });

      it("returns dash for non-number", () => {
        expect(formatDistanceWithUnits("abc" as unknown as number, "metric")).toBe("—");
      });

      it("formats zero meters", () => {
        expect(formatDistanceWithUnits(0, "metric")).toBe("0m");
      });
    });
  });

  describe("formatDistanceVerbose", () => {
    describe("metric", () => {
      it("formats 1 meter with singular", () => {
        expect(formatDistanceVerbose(1, "metric")).toBe("1 meter");
      });

      it("formats multiple meters with plural", () => {
        expect(formatDistanceVerbose(500, "metric")).toBe("500 meters");
      });

      it("formats 1 kilometer with singular", () => {
        expect(formatDistanceVerbose(1000, "metric")).toBe("1.0 kilometer");
      });

      it("formats multiple kilometers with plural", () => {
        expect(formatDistanceVerbose(5000, "metric")).toBe("5.0 kilometers");
      });
    });

    describe("imperial", () => {
      it("formats 1 foot with singular", () => {
        // 1 foot ≈ 0.3048 meters
        expect(formatDistanceVerbose(0.3048, "imperial")).toBe("1 foot");
      });

      it("formats multiple feet with plural", () => {
        expect(formatDistanceVerbose(100, "imperial")).toBe("328 feet");
      });

      it("formats miles with decimal", () => {
        expect(formatDistanceVerbose(1609.34, "imperial")).toBe("1.0 mile");
      });

      it("formats multiple miles with plural", () => {
        expect(formatDistanceVerbose(8046.7, "imperial")).toBe("5.0 miles");
      });
    });

    describe("invalid inputs", () => {
      it("returns 'Unknown distance' for negative", () => {
        expect(formatDistanceVerbose(-100, "metric")).toBe("Unknown distance");
      });

      it("returns 'Unknown distance' for NaN", () => {
        expect(formatDistanceVerbose(NaN, "metric")).toBe("Unknown distance");
      });
    });
  });

  describe("mergeWithDefaults", () => {
    const defaults = {
      theme: "light",
      fontSize: 14,
      notifications: true,
    };

    it("returns defaults when stored is null", () => {
      expect(mergeWithDefaults(null, defaults)).toEqual(defaults);
    });

    it("returns defaults when stored is undefined", () => {
      expect(mergeWithDefaults(undefined, defaults)).toEqual(defaults);
    });

    it("merges stored values with defaults", () => {
      const stored = { theme: "dark" };
      expect(mergeWithDefaults(stored, defaults)).toEqual({
        theme: "dark",
        fontSize: 14,
        notifications: true,
      });
    });

    it("stored values override defaults", () => {
      const stored = { theme: "dark", fontSize: 18 };
      const result = mergeWithDefaults(stored, defaults);
      expect(result.theme).toBe("dark");
      expect(result.fontSize).toBe(18);
    });

    it("preserves all default keys", () => {
      const stored = { theme: "dark" };
      const result = mergeWithDefaults(stored, defaults);
      expect(result).toHaveProperty("notifications");
    });

    it("returns new object, not mutated defaults", () => {
      const stored = { theme: "dark" };
      const result = mergeWithDefaults(stored, defaults);
      expect(result).not.toBe(defaults);
      expect(defaults.theme).toBe("light");
    });

    it("handles empty stored object", () => {
      expect(mergeWithDefaults({}, defaults)).toEqual(defaults);
    });
  });
});
