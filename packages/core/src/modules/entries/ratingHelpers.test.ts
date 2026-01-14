import { describe, it, expect } from "vitest";
import {
  starsToDecimal,
  decimalToStars,
  formatRatingDisplay,
  formatRatingWithIcon,
  clampRating,
  hasRating,
  getMinRating,
  getRatingTypeLabel,
} from "./ratingHelpers";

describe("ratingHelpers", () => {
  describe("starsToDecimal", () => {
    it("converts 1 star to 2", () => {
      expect(starsToDecimal(1)).toBe(2);
    });

    it("converts 2 stars to 4", () => {
      expect(starsToDecimal(2)).toBe(4);
    });

    it("converts 3 stars to 6", () => {
      expect(starsToDecimal(3)).toBe(6);
    });

    it("converts 4 stars to 8", () => {
      expect(starsToDecimal(4)).toBe(8);
    });

    it("converts 5 stars to 10", () => {
      expect(starsToDecimal(5)).toBe(10);
    });

    it("returns 0 for 0 stars", () => {
      expect(starsToDecimal(0)).toBe(0);
    });

    it("returns 0 for negative stars", () => {
      expect(starsToDecimal(-1)).toBe(0);
    });

    it("caps at 10 for stars > 5", () => {
      expect(starsToDecimal(6)).toBe(10);
      expect(starsToDecimal(10)).toBe(10);
    });
  });

  describe("decimalToStars", () => {
    it("returns 0 for 0", () => {
      expect(decimalToStars(0)).toBe(0);
    });

    it("returns 0 for negative values", () => {
      expect(decimalToStars(-1)).toBe(0);
    });

    it("returns 1 star for 0.1 - 2.5", () => {
      expect(decimalToStars(0.1)).toBe(1);
      expect(decimalToStars(1)).toBe(1);
      expect(decimalToStars(2)).toBe(1);
      expect(decimalToStars(2.5)).toBe(1);
    });

    it("returns 2 stars for 2.6 - 4.5", () => {
      expect(decimalToStars(2.6)).toBe(2);
      expect(decimalToStars(3)).toBe(2);
      expect(decimalToStars(4)).toBe(2);
      expect(decimalToStars(4.5)).toBe(2);
    });

    it("returns 3 stars for 4.6 - 6.5", () => {
      expect(decimalToStars(4.6)).toBe(3);
      expect(decimalToStars(5)).toBe(3);
      expect(decimalToStars(6)).toBe(3);
      expect(decimalToStars(6.5)).toBe(3);
    });

    it("returns 4 stars for 6.6 - 8.5", () => {
      expect(decimalToStars(6.6)).toBe(4);
      expect(decimalToStars(7)).toBe(4);
      expect(decimalToStars(8)).toBe(4);
      expect(decimalToStars(8.5)).toBe(4);
    });

    it("returns 5 stars for 8.6 - 10", () => {
      expect(decimalToStars(8.6)).toBe(5);
      expect(decimalToStars(9)).toBe(5);
      expect(decimalToStars(10)).toBe(5);
    });
  });

  describe("formatRatingDisplay", () => {
    it("returns empty string for 0 rating", () => {
      expect(formatRatingDisplay(0, "stars")).toBe("");
      expect(formatRatingDisplay(0, "decimal")).toBe("");
      expect(formatRatingDisplay(0, "decimal_whole")).toBe("");
    });

    it("returns empty string for negative rating", () => {
      expect(formatRatingDisplay(-1, "stars")).toBe("");
    });

    describe("stars mode", () => {
      it("formats as X/5", () => {
        expect(formatRatingDisplay(2, "stars")).toBe("1/5");
        expect(formatRatingDisplay(6, "stars")).toBe("3/5");
        expect(formatRatingDisplay(10, "stars")).toBe("5/5");
      });

      it("is default mode", () => {
        expect(formatRatingDisplay(6)).toBe("3/5");
      });
    });

    describe("decimal_whole mode", () => {
      it("formats as X/10 with rounding", () => {
        expect(formatRatingDisplay(7, "decimal_whole")).toBe("7/10");
        expect(formatRatingDisplay(7.4, "decimal_whole")).toBe("7/10");
        expect(formatRatingDisplay(7.6, "decimal_whole")).toBe("8/10");
      });
    });

    describe("decimal mode", () => {
      it("formats as X.X/10", () => {
        expect(formatRatingDisplay(7.5, "decimal")).toBe("7.5/10");
        expect(formatRatingDisplay(10, "decimal")).toBe("10.0/10");
        expect(formatRatingDisplay(0.1, "decimal")).toBe("0.1/10");
      });
    });
  });

  describe("formatRatingWithIcon", () => {
    it("returns empty string for 0 rating", () => {
      expect(formatRatingWithIcon(0, "stars")).toBe("");
    });

    it("returns empty string for negative rating", () => {
      expect(formatRatingWithIcon(-1, "stars")).toBe("");
    });

    describe("stars mode", () => {
      it("returns filled stars", () => {
        expect(formatRatingWithIcon(2, "stars")).toBe("★");
        expect(formatRatingWithIcon(4, "stars")).toBe("★★");
        expect(formatRatingWithIcon(6, "stars")).toBe("★★★");
        expect(formatRatingWithIcon(8, "stars")).toBe("★★★★");
        expect(formatRatingWithIcon(10, "stars")).toBe("★★★★★");
      });
    });

    describe("decimal_whole mode", () => {
      it("formats with star icon and whole number", () => {
        expect(formatRatingWithIcon(7, "decimal_whole")).toBe("★ 7");
        expect(formatRatingWithIcon(7.6, "decimal_whole")).toBe("★ 8");
      });
    });

    describe("decimal mode", () => {
      it("formats with star icon and decimal", () => {
        expect(formatRatingWithIcon(7.5, "decimal")).toBe("★ 7.5");
        expect(formatRatingWithIcon(10, "decimal")).toBe("★ 10.0");
      });
    });
  });

  describe("clampRating", () => {
    it("returns 0 for negative values", () => {
      expect(clampRating(-1)).toBe(0);
      expect(clampRating(-100)).toBe(0);
    });

    it("returns 10 for values > 10", () => {
      expect(clampRating(11)).toBe(10);
      expect(clampRating(100)).toBe(10);
    });

    it("returns value for valid range", () => {
      expect(clampRating(5)).toBe(5);
      expect(clampRating(0)).toBe(0);
      expect(clampRating(10)).toBe(10);
    });

    it("rounds to 1 decimal place", () => {
      expect(clampRating(5.55)).toBe(5.6);
      expect(clampRating(5.54)).toBe(5.5);
      expect(clampRating(7.777)).toBe(7.8);
    });
  });

  describe("hasRating", () => {
    it("returns false for 0", () => {
      expect(hasRating(0)).toBe(false);
    });

    it("returns false for negative values", () => {
      expect(hasRating(-1)).toBe(false);
    });

    it("returns true for positive values", () => {
      expect(hasRating(0.1)).toBe(true);
      expect(hasRating(5)).toBe(true);
      expect(hasRating(10)).toBe(true);
    });
  });

  describe("getMinRating", () => {
    it("returns 2 for stars (1 star = 2)", () => {
      expect(getMinRating("stars")).toBe(2);
    });

    it("returns 1 for decimal_whole", () => {
      expect(getMinRating("decimal_whole")).toBe(1);
    });

    it("returns 0.1 for decimal", () => {
      expect(getMinRating("decimal")).toBe(0.1);
    });

    it("defaults to stars (2)", () => {
      expect(getMinRating()).toBe(2);
    });
  });

  describe("getRatingTypeLabel", () => {
    it("returns label for stars", () => {
      expect(getRatingTypeLabel("stars")).toBe("Stars (1-5)");
    });

    it("returns label for decimal_whole", () => {
      expect(getRatingTypeLabel("decimal_whole")).toBe("10-Base (0-10)");
    });

    it("returns label for decimal", () => {
      expect(getRatingTypeLabel("decimal")).toBe("10-Base with Decimals");
    });

    it("returns stars label for unknown type", () => {
      expect(getRatingTypeLabel("unknown" as any)).toBe("Stars (1-5)");
    });
  });
});
