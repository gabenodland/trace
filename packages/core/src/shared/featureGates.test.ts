import { describe, it, expect } from "vitest";
import {
  hasFeature,
  getFeatureLimit,
  isLimitReached,
  getEffectiveTier,
  getFeaturesForTier,
} from "./featureGates";

describe("featureGates", () => {
  describe("hasFeature", () => {
    it("grants apiAccess to pro tier", () => {
      expect(hasFeature("apiAccess", "pro")).toBe(true);
    });

    it("denies apiAccess to free tier", () => {
      expect(hasFeature("apiAccess", "free")).toBe(false);
    });

    it("grants cloudSync to pro tier", () => {
      expect(hasFeature("cloudSync", "pro")).toBe(true);
    });

    it("denies cloudSync to free tier", () => {
      expect(hasFeature("cloudSync", "free")).toBe(false);
    });
  });

  describe("getFeatureLimit", () => {
    it("returns 500 max entries for free tier", () => {
      expect(getFeatureLimit("maxEntries", "free")).toBe(500);
    });

    it("returns Infinity max entries for pro tier", () => {
      expect(getFeatureLimit("maxEntries", "pro")).toBe(Infinity);
    });
  });

  describe("isLimitReached", () => {
    it("returns true when at limit", () => {
      expect(isLimitReached("maxEntries", "free", 500)).toBe(true);
    });

    it("returns true when over limit", () => {
      expect(isLimitReached("maxEntries", "free", 501)).toBe(true);
    });

    it("returns false when below limit", () => {
      expect(isLimitReached("maxEntries", "free", 499)).toBe(false);
    });

    it("never reached for Infinity limits", () => {
      expect(isLimitReached("maxEntries", "pro", 999999)).toBe(false);
    });
  });

  describe("getEffectiveTier", () => {
    it("returns pro for dev mode regardless of tier", () => {
      expect(getEffectiveTier("free", null, true)).toBe("pro");
    });

    it("returns free when subscription expired", () => {
      expect(getEffectiveTier("pro", "2020-01-01T00:00:00Z", false)).toBe("free");
    });

    it("returns pro when subscription not expired", () => {
      expect(getEffectiveTier("pro", "2099-01-01T00:00:00Z", false)).toBe("pro");
    });

    it("returns tier as-is when no expiration", () => {
      expect(getEffectiveTier("pro", null, false)).toBe("pro");
      expect(getEffectiveTier("free", null, false)).toBe("free");
    });

    it("dev mode overrides even expired subscription", () => {
      expect(getEffectiveTier("pro", "2020-01-01T00:00:00Z", true)).toBe("pro");
    });
  });

  describe("getFeaturesForTier", () => {
    it("returns no boolean features for free tier", () => {
      const { booleanFeatures } = getFeaturesForTier("free");
      expect(booleanFeatures).toEqual([]);
    });

    it("returns all boolean features for pro tier", () => {
      const { booleanFeatures } = getFeaturesForTier("pro");
      expect(booleanFeatures).toContain("apiAccess");
      expect(booleanFeatures).toContain("allThemes");
      expect(booleanFeatures).toContain("allFonts");
      expect(booleanFeatures).toContain("cloudSync");
      expect(booleanFeatures.length).toBeGreaterThan(10);
    });

    it("returns correct limits per tier", () => {
      const free = getFeaturesForTier("free");
      const pro = getFeaturesForTier("pro");
      expect(free.limits.maxEntries).toBe(500);
      expect(pro.limits.maxEntries).toBe(Infinity);
      expect(free.limits.maxStreams).toBe(5);
      expect(pro.limits.maxStreams).toBe(Infinity);
    });
  });
});
