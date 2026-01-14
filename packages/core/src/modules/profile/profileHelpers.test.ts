import { describe, it, expect } from "vitest";
import {
  validateUsername,
  validateName,
  validateImageFile,
  getDefaultAvatarUrl,
  getAvatarUrl,
  formatUsername,
  getInitials,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
  AVATAR_MAX_SIZE_MB,
  AVATAR_MAX_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "./profileHelpers";

describe("profileHelpers", () => {
  describe("constants", () => {
    it("has correct username length limits", () => {
      expect(USERNAME_MIN_LENGTH).toBe(3);
      expect(USERNAME_MAX_LENGTH).toBe(30);
    });

    it("has correct name max length", () => {
      expect(NAME_MAX_LENGTH).toBe(50);
    });

    it("has correct avatar size limits", () => {
      expect(AVATAR_MAX_SIZE_MB).toBe(5);
      expect(AVATAR_MAX_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });

    it("has correct allowed image types", () => {
      expect(ALLOWED_IMAGE_TYPES).toContain("image/jpeg");
      expect(ALLOWED_IMAGE_TYPES).toContain("image/jpg");
      expect(ALLOWED_IMAGE_TYPES).toContain("image/png");
      expect(ALLOWED_IMAGE_TYPES).toContain("image/webp");
    });
  });

  describe("validateUsername", () => {
    it("returns invalid for empty username", () => {
      expect(validateUsername("")).toEqual({ isValid: false, error: "Username is required" });
    });

    it("returns invalid for whitespace-only username", () => {
      expect(validateUsername("   ")).toEqual({ isValid: false, error: "Username is required" });
    });

    it("returns invalid for username shorter than 3 characters", () => {
      expect(validateUsername("ab")).toEqual({
        isValid: false,
        error: "Username must be at least 3 characters",
      });
    });

    it("returns invalid for username longer than 30 characters", () => {
      const longUsername = "a".repeat(31);
      expect(validateUsername(longUsername)).toEqual({
        isValid: false,
        error: "Username must be at most 30 characters",
      });
    });

    it("returns invalid for username with special characters", () => {
      expect(validateUsername("user@name")).toEqual({
        isValid: false,
        error: "Username can only contain letters, numbers, and underscores",
      });
    });

    it("returns invalid for username with spaces", () => {
      expect(validateUsername("user name")).toEqual({
        isValid: false,
        error: "Username can only contain letters, numbers, and underscores",
      });
    });

    it("returns invalid for username with consecutive underscores", () => {
      expect(validateUsername("user__name")).toEqual({
        isValid: false,
        error: "Username cannot have consecutive underscores",
      });
    });

    it("returns valid for alphanumeric username", () => {
      expect(validateUsername("user123")).toEqual({ isValid: true });
    });

    it("returns valid for username with single underscores", () => {
      expect(validateUsername("user_name_123")).toEqual({ isValid: true });
    });

    it("returns valid for exactly 3 character username", () => {
      expect(validateUsername("abc")).toEqual({ isValid: true });
    });

    it("returns valid for exactly 30 character username", () => {
      expect(validateUsername("a".repeat(30))).toEqual({ isValid: true });
    });

    it("trims whitespace before validation", () => {
      expect(validateUsername("  user123  ")).toEqual({ isValid: true });
    });
  });

  describe("validateName", () => {
    it("returns invalid for empty name", () => {
      expect(validateName("")).toEqual({ isValid: false, error: "Name is required" });
    });

    it("returns invalid for whitespace-only name", () => {
      expect(validateName("   ")).toEqual({ isValid: false, error: "Name is required" });
    });

    it("returns invalid for name longer than 50 characters", () => {
      const longName = "a".repeat(51);
      expect(validateName(longName)).toEqual({
        isValid: false,
        error: "Name must be at most 50 characters",
      });
    });

    it("returns valid for normal name", () => {
      expect(validateName("John Doe")).toEqual({ isValid: true });
    });

    it("returns valid for name with exactly 50 characters", () => {
      expect(validateName("a".repeat(50))).toEqual({ isValid: true });
    });

    it("allows special characters in name", () => {
      expect(validateName("José García-López")).toEqual({ isValid: true });
    });
  });

  describe("validateImageFile", () => {
    it("returns invalid for null file", () => {
      expect(validateImageFile(null)).toEqual({ isValid: false, error: "No file selected" });
    });

    it("returns invalid for unsupported image type", () => {
      expect(validateImageFile({ type: "image/gif", size: 1000 })).toEqual({
        isValid: false,
        error: "Image must be JPEG, PNG, or WebP",
      });
    });

    it("returns invalid for non-image file", () => {
      expect(validateImageFile({ type: "application/pdf", size: 1000 })).toEqual({
        isValid: false,
        error: "Image must be JPEG, PNG, or WebP",
      });
    });

    it("returns invalid for file larger than 5MB", () => {
      const largeSize = AVATAR_MAX_SIZE_BYTES + 1;
      expect(validateImageFile({ type: "image/jpeg", size: largeSize })).toEqual({
        isValid: false,
        error: "Image must be smaller than 5MB",
      });
    });

    it("returns valid for JPEG file under size limit", () => {
      expect(validateImageFile({ type: "image/jpeg", size: 1000000 })).toEqual({ isValid: true });
    });

    it("returns valid for PNG file", () => {
      expect(validateImageFile({ type: "image/png", size: 1000 })).toEqual({ isValid: true });
    });

    it("returns valid for WebP file", () => {
      expect(validateImageFile({ type: "image/webp", size: 1000 })).toEqual({ isValid: true });
    });

    it("returns valid for file at exactly size limit", () => {
      expect(validateImageFile({ type: "image/jpeg", size: AVATAR_MAX_SIZE_BYTES })).toEqual({
        isValid: true,
      });
    });

    it("returns valid when type is missing", () => {
      expect(validateImageFile({ size: 1000 })).toEqual({ isValid: true });
    });

    it("returns valid when size is missing", () => {
      expect(validateImageFile({ type: "image/jpeg" })).toEqual({ isValid: true });
    });
  });

  describe("getDefaultAvatarUrl", () => {
    it("returns URL with encoded name", () => {
      const url = getDefaultAvatarUrl("John Doe");
      expect(url).toContain("ui-avatars.com");
      expect(url).toContain("name=John%20Doe");
    });

    it("uses 'User' as default for empty name", () => {
      const url = getDefaultAvatarUrl("");
      expect(url).toContain("name=User");
    });

    it("includes styling parameters", () => {
      const url = getDefaultAvatarUrl("Test");
      expect(url).toContain("background=");
      expect(url).toContain("color=");
      expect(url).toContain("size=256");
    });
  });

  describe("getAvatarUrl", () => {
    it("returns custom URL when provided", () => {
      const customUrl = "https://example.com/avatar.jpg";
      expect(getAvatarUrl(customUrl, "John")).toBe(customUrl);
    });

    it("returns default URL when custom is null", () => {
      const url = getAvatarUrl(null, "John");
      expect(url).toContain("ui-avatars.com");
    });

    it("returns default URL when custom is empty string", () => {
      const url = getAvatarUrl("", "John");
      expect(url).toContain("ui-avatars.com");
    });
  });

  describe("formatUsername", () => {
    it("adds @ prefix to username", () => {
      expect(formatUsername("johndoe")).toBe("@johndoe");
    });

    it("works with empty string", () => {
      expect(formatUsername("")).toBe("@");
    });
  });

  describe("getInitials", () => {
    it("returns single initial for single name", () => {
      expect(getInitials("John")).toBe("J");
    });

    it("returns two initials for two names", () => {
      expect(getInitials("John Doe")).toBe("JD");
    });

    it("returns first and last initials for multiple names", () => {
      expect(getInitials("John Michael Doe")).toBe("JD");
    });

    it("returns uppercase initials", () => {
      expect(getInitials("john doe")).toBe("JD");
    });

    it("handles extra whitespace", () => {
      expect(getInitials("  John   Doe  ")).toBe("JD");
    });

    it("returns empty string for empty string input", () => {
      expect(getInitials("")).toBe("");
    });

    it("returns empty string for whitespace-only string", () => {
      expect(getInitials("   ")).toBe("");
    });
  });
});
