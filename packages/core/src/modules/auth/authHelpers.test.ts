import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateLoginForm,
  validateSignupForm,
  AUTH_VALIDATION,
} from "./authHelpers";

describe("authHelpers", () => {
  describe("AUTH_VALIDATION constants", () => {
    it("has correct minimum password length", () => {
      expect(AUTH_VALIDATION.MIN_PASSWORD_LENGTH).toBe(6);
    });

    it("has email regex defined", () => {
      expect(AUTH_VALIDATION.EMAIL_REGEX).toBeInstanceOf(RegExp);
    });
  });

  describe("validateEmail", () => {
    it("returns invalid for empty email", () => {
      expect(validateEmail("")).toEqual({ isValid: false, error: "Email is required" });
    });

    it("returns invalid for whitespace-only email", () => {
      // Note: current implementation doesn't trim, so whitespace passes regex check
      // This tests the actual behavior
      expect(validateEmail("   ").isValid).toBe(false);
    });

    it("returns invalid for email without @", () => {
      expect(validateEmail("testexample.com")).toEqual({
        isValid: false,
        error: "Please enter a valid email address",
      });
    });

    it("returns invalid for email without domain", () => {
      expect(validateEmail("test@")).toEqual({
        isValid: false,
        error: "Please enter a valid email address",
      });
    });

    it("returns invalid for email without TLD", () => {
      expect(validateEmail("test@example")).toEqual({
        isValid: false,
        error: "Please enter a valid email address",
      });
    });

    it("returns valid for correct email format", () => {
      expect(validateEmail("test@example.com")).toEqual({ isValid: true });
    });

    it("returns valid for email with subdomain", () => {
      expect(validateEmail("test@mail.example.com")).toEqual({ isValid: true });
    });

    it("returns valid for email with plus sign", () => {
      expect(validateEmail("test+filter@example.com")).toEqual({ isValid: true });
    });

    it("returns valid for email with dots in local part", () => {
      expect(validateEmail("first.last@example.com")).toEqual({ isValid: true });
    });
  });

  describe("validatePassword", () => {
    it("returns invalid for empty password", () => {
      expect(validatePassword("")).toEqual({ isValid: false, error: "Password is required" });
    });

    it("returns invalid for password shorter than minimum", () => {
      expect(validatePassword("12345")).toEqual({
        isValid: false,
        error: "Password must be at least 6 characters",
      });
    });

    it("returns invalid for password with 5 characters", () => {
      expect(validatePassword("abcde").isValid).toBe(false);
    });

    it("returns valid for password with exactly 6 characters", () => {
      expect(validatePassword("123456")).toEqual({ isValid: true });
    });

    it("returns valid for longer password", () => {
      expect(validatePassword("mysecurepassword123")).toEqual({ isValid: true });
    });
  });

  describe("validatePasswordConfirmation", () => {
    it("returns invalid for empty confirmation", () => {
      expect(validatePasswordConfirmation("password", "")).toEqual({
        isValid: false,
        error: "Please confirm your password",
      });
    });

    it("returns invalid when passwords do not match", () => {
      expect(validatePasswordConfirmation("password1", "password2")).toEqual({
        isValid: false,
        error: "Passwords do not match",
      });
    });

    it("returns valid when passwords match", () => {
      expect(validatePasswordConfirmation("password123", "password123")).toEqual({
        isValid: true,
      });
    });

    it("is case-sensitive", () => {
      expect(validatePasswordConfirmation("Password", "password").isValid).toBe(false);
    });
  });

  describe("validateLoginForm", () => {
    it("returns invalid for empty email", () => {
      const result = validateLoginForm("", "password123");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Email is required");
    });

    it("returns invalid for invalid email format", () => {
      const result = validateLoginForm("notanemail", "password123");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Please enter a valid email address");
    });

    it("returns invalid for empty password", () => {
      const result = validateLoginForm("test@example.com", "");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Password is required");
    });

    it("returns valid for correct email and password", () => {
      expect(validateLoginForm("test@example.com", "password123")).toEqual({
        isValid: true,
      });
    });

    it("does not validate password length (login allows any)", () => {
      // Login doesn't need to validate password length - just that it's not empty
      expect(validateLoginForm("test@example.com", "short").isValid).toBe(true);
    });
  });

  describe("validateSignupForm", () => {
    it("returns invalid for empty email", () => {
      const result = validateSignupForm("", "password123", "password123");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Email is required");
    });

    it("returns invalid for invalid email format", () => {
      const result = validateSignupForm("notanemail", "password123", "password123");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Please enter a valid email address");
    });

    it("returns invalid for short password", () => {
      const result = validateSignupForm("test@example.com", "12345", "12345");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Password must be at least 6 characters");
    });

    it("returns invalid for mismatched passwords", () => {
      const result = validateSignupForm("test@example.com", "password123", "password456");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Passwords do not match");
    });

    it("returns invalid for empty confirmation", () => {
      const result = validateSignupForm("test@example.com", "password123", "");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Please confirm your password");
    });

    it("returns valid for correct signup data", () => {
      expect(validateSignupForm("test@example.com", "password123", "password123")).toEqual({
        isValid: true,
      });
    });

    it("validates in order: email, password, confirmation", () => {
      // All invalid - should return email error first
      const result1 = validateSignupForm("", "short", "different");
      expect(result1.error).toBe("Email is required");

      // Email valid, password too short
      const result2 = validateSignupForm("test@example.com", "short", "different");
      expect(result2.error).toBe("Password must be at least 6 characters");

      // Email and password valid, confirmation doesn't match
      const result3 = validateSignupForm("test@example.com", "password123", "different");
      expect(result3.error).toBe("Passwords do not match");
    });
  });
});
