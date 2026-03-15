import { describe, it, expect } from "vitest";
import {
  formatBytes,
  mbToBytes,
  bytesToMb,
  getStoragePercentage,
  getStorageWarningLevel,
  isStorageLimitReached,
  formatStorageUsage,
} from "./dataManagementHelpers";

// ============================================
// BYTE FORMATTING
// ============================================

describe("formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats negative as 0 B", () => {
    expect(formatBytes(-100)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(150 * 1024 * 1024)).toBe("150 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
    expect(formatBytes(1.8 * 1024 * 1024 * 1024)).toBe("1.8 GB");
  });

  it("respects decimal parameter", () => {
    expect(formatBytes(1536, 2)).toBe("1.50 KB");
    expect(formatBytes(1536, 0)).toBe("2 KB");
  });

  it("shows integers without trailing zeros", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2 MB");
  });
});

// ============================================
// UNIT CONVERSIONS
// ============================================

describe("mbToBytes", () => {
  it("converts MB to bytes", () => {
    expect(mbToBytes(1)).toBe(1048576);
    expect(mbToBytes(200)).toBe(200 * 1024 * 1024);
  });
});

describe("bytesToMb", () => {
  it("converts bytes to MB", () => {
    expect(bytesToMb(1048576)).toBe(1);
    expect(bytesToMb(200 * 1024 * 1024)).toBe(200);
  });
});

// ============================================
// STORAGE PERCENTAGE
// ============================================

describe("getStoragePercentage", () => {
  it("calculates percentage correctly", () => {
    const usedBytes = 100 * 1024 * 1024; // 100 MB
    expect(getStoragePercentage(usedBytes, 200)).toBe(50);
  });

  it("returns 0 for zero limit", () => {
    expect(getStoragePercentage(1000, 0)).toBe(0);
  });

  it("can exceed 100%", () => {
    const usedBytes = 300 * 1024 * 1024; // 300 MB
    expect(getStoragePercentage(usedBytes, 200)).toBe(150);
  });

  it("handles zero usage", () => {
    expect(getStoragePercentage(0, 200)).toBe(0);
  });
});

// ============================================
// WARNING LEVELS
// ============================================

describe("getStorageWarningLevel", () => {
  const limit = 200; // 200 MB

  it("returns normal below 80%", () => {
    const used = 100 * 1024 * 1024; // 50%
    expect(getStorageWarningLevel(used, limit)).toBe("normal");
  });

  it("returns warning at 80%", () => {
    const used = 160 * 1024 * 1024; // 80%
    expect(getStorageWarningLevel(used, limit)).toBe("warning");
  });

  it("returns warning at 85%", () => {
    const used = 170 * 1024 * 1024; // 85%
    expect(getStorageWarningLevel(used, limit)).toBe("warning");
  });

  it("returns critical at 90%", () => {
    const used = 180 * 1024 * 1024; // 90%
    expect(getStorageWarningLevel(used, limit)).toBe("critical");
  });

  it("returns exceeded at 100%", () => {
    const used = 200 * 1024 * 1024; // 100%
    expect(getStorageWarningLevel(used, limit)).toBe("exceeded");
  });

  it("returns exceeded over 100%", () => {
    const used = 250 * 1024 * 1024; // 125%
    expect(getStorageWarningLevel(used, limit)).toBe("exceeded");
  });
});

// ============================================
// LIMIT CHECK
// ============================================

describe("isStorageLimitReached", () => {
  it("returns false when under limit", () => {
    const used = 100 * 1024 * 1024; // 100 MB
    expect(isStorageLimitReached(used, 200)).toBe(false);
  });

  it("returns false at 90% (critical but not exceeded)", () => {
    const used = 180 * 1024 * 1024; // 90%
    expect(isStorageLimitReached(used, 200)).toBe(false);
  });

  it("returns true at 100%", () => {
    const used = 200 * 1024 * 1024;
    expect(isStorageLimitReached(used, 200)).toBe(true);
  });

  it("returns true over limit", () => {
    const used = 300 * 1024 * 1024;
    expect(isStorageLimitReached(used, 200)).toBe(true);
  });
});

// ============================================
// DISPLAY FORMATTING
// ============================================

describe("formatStorageUsage", () => {
  it("formats usage against limit", () => {
    const used = 87 * 1024 * 1024; // 87 MB
    expect(formatStorageUsage(used, 200)).toBe("87 MB of 200 MB");
  });

  it("formats large usage", () => {
    const used = 1.8 * 1024 * 1024 * 1024; // 1.8 GB
    expect(formatStorageUsage(used, 2048)).toBe("1.8 GB of 2 GB");
  });
});
