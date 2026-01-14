import { describe, it, expect } from "vitest";
import {
  extractAttachmentIds,
  insertAttachmentIntoContent,
  removeAttachmentFromContent,
  replaceAttachmentReferences,
  generateAttachmentPath,
  generateThumbnailPath,
  getExtensionFromMimeType,
  isImageMimeType,
  formatFileSize,
  isFileSizeValid,
  sortAttachmentsByPosition,
  getAttachmentsForEntry,
  getNextAttachmentPosition,
  isAttachmentUploaded,
  needsSync,
  getAttachmentsNeedingUpload,
  getAttachmentsNeedingSync,
  countAttachmentsInContent,
  validateAttachment,
} from "./attachmentHelpers";
import type { Attachment } from "./AttachmentTypes";

// Helper to create mock attachment
const createAttachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  attachment_id: "test-attachment-id",
  entry_id: "test-entry-id",
  user_id: "test-user-id",
  file_path: "path/to/file.jpg",
  local_path: null,
  mime_type: "image/jpeg",
  file_size: 1000,
  position: 0,
  uploaded: true,
  created_at: "2024-01-01T00:00:00Z",
  synced: 1,
  sync_action: null,
  ...overrides,
});

describe("attachmentHelpers", () => {
  describe("extractAttachmentIds", () => {
    it("extracts single attachment ID", () => {
      const html = '<img data-attachment-id="abc123" />';
      expect(extractAttachmentIds(html)).toEqual(["abc123"]);
    });

    it("extracts multiple attachment IDs", () => {
      const html = '<img data-attachment-id="id1" /><img data-attachment-id="id2" />';
      expect(extractAttachmentIds(html)).toEqual(["id1", "id2"]);
    });

    it("handles legacy photo-id format", () => {
      const html = '<img data-photo-id="legacy123" />';
      expect(extractAttachmentIds(html)).toEqual(["legacy123"]);
    });

    it("returns empty array for no attachments", () => {
      expect(extractAttachmentIds("<p>No images here</p>")).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      expect(extractAttachmentIds("")).toEqual([]);
    });

    it("ignores images without attachment ID", () => {
      const html = '<img src="http://example.com/image.jpg" />';
      expect(extractAttachmentIds(html)).toEqual([]);
    });
  });

  describe("insertAttachmentIntoContent", () => {
    it("creates image tag for empty content", () => {
      const result = insertAttachmentIntoContent("", "abc123");
      expect(result).toBe('<img data-attachment-id="abc123" />');
    });

    it("creates image tag for whitespace-only content", () => {
      const result = insertAttachmentIntoContent("   ", "abc123");
      expect(result).toBe('<img data-attachment-id="abc123" />');
    });

    it("appends to existing content with paragraph break", () => {
      const result = insertAttachmentIntoContent("<p>Existing</p>", "abc123");
      expect(result).toBe('<p>Existing</p><p></p><img data-attachment-id="abc123" />');
    });
  });

  describe("removeAttachmentFromContent", () => {
    it("removes attachment by ID", () => {
      const html = '<p>Text</p><img data-attachment-id="abc123" />';
      const result = removeAttachmentFromContent(html, "abc123");
      expect(result).toBe("<p>Text</p>");
    });

    it("removes legacy photo-id format", () => {
      const html = '<img data-photo-id="legacy123" />';
      const result = removeAttachmentFromContent(html, "legacy123");
      expect(result).toBe("");
    });

    it("cleans up empty paragraphs", () => {
      const html = '<p></p><img data-attachment-id="abc123" /><p></p>';
      const result = removeAttachmentFromContent(html, "abc123");
      expect(result).toBe("");
    });

    it("returns empty string for empty content", () => {
      expect(removeAttachmentFromContent("", "abc")).toBe("");
    });

    it("leaves other content intact", () => {
      const html = '<img data-attachment-id="keep" /><img data-attachment-id="remove" />';
      const result = removeAttachmentFromContent(html, "remove");
      expect(result).toContain('data-attachment-id="keep"');
      expect(result).not.toContain("remove");
    });
  });

  describe("replaceAttachmentReferences", () => {
    it("replaces attachment IDs with URLs", () => {
      const html = '<img data-attachment-id="abc123" />';
      const attachments = [createAttachment({ attachment_id: "abc123" })];
      const getUrl = () => "http://example.com/image.jpg";

      const result = replaceAttachmentReferences(html, attachments, getUrl);
      expect(result).toContain('src="http://example.com/image.jpg"');
    });

    it("returns original content when no attachments", () => {
      const html = "<p>No images</p>";
      expect(replaceAttachmentReferences(html, [], () => "")).toBe(html);
    });

    it("returns original content when empty", () => {
      expect(replaceAttachmentReferences("", [createAttachment()], () => "url")).toBe("");
    });
  });

  describe("generateAttachmentPath", () => {
    it("generates correct path format", () => {
      const path = generateAttachmentPath("user1", "entry1", "attach1", "jpg");
      expect(path).toBe("user1/entry1/attach1.jpg");
    });

    it("uses jpg as default extension", () => {
      const path = generateAttachmentPath("user1", "entry1", "attach1");
      expect(path).toBe("user1/entry1/attach1.jpg");
    });
  });

  describe("generateThumbnailPath", () => {
    it("generates thumbnail path with _thumb suffix", () => {
      const path = generateThumbnailPath("user1", "entry1", "attach1", "jpg");
      expect(path).toBe("user1/entry1/attach1_thumb.jpg");
    });

    it("uses jpg as default extension", () => {
      const path = generateThumbnailPath("user1", "entry1", "attach1");
      expect(path).toBe("user1/entry1/attach1_thumb.jpg");
    });
  });

  describe("getExtensionFromMimeType", () => {
    it("returns jpg for image/jpeg", () => {
      expect(getExtensionFromMimeType("image/jpeg")).toBe("jpg");
    });

    it("returns png for image/png", () => {
      expect(getExtensionFromMimeType("image/png")).toBe("png");
    });

    it("returns webp for image/webp", () => {
      expect(getExtensionFromMimeType("image/webp")).toBe("webp");
    });

    it("returns heic for image/heic", () => {
      expect(getExtensionFromMimeType("image/heic")).toBe("heic");
    });

    it("returns pdf for application/pdf", () => {
      expect(getExtensionFromMimeType("application/pdf")).toBe("pdf");
    });

    it("returns bin for unknown mime type", () => {
      expect(getExtensionFromMimeType("application/unknown")).toBe("bin");
    });
  });

  describe("isImageMimeType", () => {
    it("returns true for image types", () => {
      expect(isImageMimeType("image/jpeg")).toBe(true);
      expect(isImageMimeType("image/png")).toBe(true);
      expect(isImageMimeType("image/webp")).toBe(true);
    });

    it("returns false for non-image types", () => {
      expect(isImageMimeType("application/pdf")).toBe(false);
      expect(isImageMimeType("text/plain")).toBe(false);
    });
  });

  describe("formatFileSize", () => {
    it("formats bytes", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("formats kilobytes", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(2048)).toBe("2 KB");
    });

    it("formats megabytes", () => {
      expect(formatFileSize(1048576)).toBe("1 MB");
      expect(formatFileSize(5242880)).toBe("5 MB");
    });

    it("formats with decimals", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    it("returns 0 B for 0", () => {
      expect(formatFileSize(0)).toBe("0 B");
    });
  });

  describe("isFileSizeValid", () => {
    it("returns true for size under limit", () => {
      expect(isFileSizeValid(1000000, 5242880)).toBe(true);
    });

    it("returns true for size at limit", () => {
      expect(isFileSizeValid(5242880, 5242880)).toBe(true);
    });

    it("returns false for size over limit", () => {
      expect(isFileSizeValid(6000000, 5242880)).toBe(false);
    });

    it("uses default 5MB limit", () => {
      expect(isFileSizeValid(5000000)).toBe(true);
      expect(isFileSizeValid(6000000)).toBe(false);
    });
  });

  describe("sortAttachmentsByPosition", () => {
    it("sorts by position ascending", () => {
      const attachments = [
        createAttachment({ attachment_id: "3", position: 2 }),
        createAttachment({ attachment_id: "1", position: 0 }),
        createAttachment({ attachment_id: "2", position: 1 }),
      ];
      const sorted = sortAttachmentsByPosition(attachments);
      expect(sorted[0].position).toBe(0);
      expect(sorted[1].position).toBe(1);
      expect(sorted[2].position).toBe(2);
    });

    it("does not mutate original array", () => {
      const attachments = [
        createAttachment({ position: 2 }),
        createAttachment({ position: 0 }),
      ];
      const original = [...attachments];
      sortAttachmentsByPosition(attachments);
      expect(attachments[0].position).toBe(original[0].position);
    });
  });

  describe("getAttachmentsForEntry", () => {
    it("filters by entry ID", () => {
      const attachments = [
        createAttachment({ entry_id: "entry1", attachment_id: "1" }),
        createAttachment({ entry_id: "entry2", attachment_id: "2" }),
        createAttachment({ entry_id: "entry1", attachment_id: "3" }),
      ];
      const result = getAttachmentsForEntry(attachments, "entry1");
      expect(result).toHaveLength(2);
      expect(result.every((a) => a.entry_id === "entry1")).toBe(true);
    });

    it("returns sorted by position", () => {
      const attachments = [
        createAttachment({ entry_id: "entry1", position: 2 }),
        createAttachment({ entry_id: "entry1", position: 0 }),
      ];
      const result = getAttachmentsForEntry(attachments, "entry1");
      expect(result[0].position).toBe(0);
      expect(result[1].position).toBe(2);
    });
  });

  describe("getNextAttachmentPosition", () => {
    it("returns 0 for empty array", () => {
      expect(getNextAttachmentPosition([])).toBe(0);
    });

    it("returns max position + 1", () => {
      const attachments = [
        createAttachment({ position: 0 }),
        createAttachment({ position: 2 }),
        createAttachment({ position: 1 }),
      ];
      expect(getNextAttachmentPosition(attachments)).toBe(3);
    });
  });

  describe("isAttachmentUploaded", () => {
    it("returns true when uploaded is true", () => {
      expect(isAttachmentUploaded(createAttachment({ uploaded: true }))).toBe(true);
    });

    it("returns false when uploaded is false", () => {
      expect(isAttachmentUploaded(createAttachment({ uploaded: false }))).toBe(false);
    });
  });

  describe("needsSync", () => {
    it("returns true when synced is 0", () => {
      expect(needsSync(createAttachment({ synced: 0 }))).toBe(true);
    });

    it("returns true when sync_action is not null", () => {
      expect(needsSync(createAttachment({ synced: 1, sync_action: "update" }))).toBe(true);
    });

    it("returns false when synced and no action", () => {
      expect(needsSync(createAttachment({ synced: 1, sync_action: null }))).toBe(false);
    });
  });

  describe("getAttachmentsNeedingUpload", () => {
    it("returns attachments not uploaded", () => {
      const attachments = [
        createAttachment({ attachment_id: "1", uploaded: true }),
        createAttachment({ attachment_id: "2", uploaded: false }),
        createAttachment({ attachment_id: "3", uploaded: false }),
      ];
      const result = getAttachmentsNeedingUpload(attachments);
      expect(result).toHaveLength(2);
      expect(result.every((a) => a.uploaded === false)).toBe(true);
    });
  });

  describe("getAttachmentsNeedingSync", () => {
    it("returns attachments needing sync", () => {
      const attachments = [
        createAttachment({ attachment_id: "1", synced: 1, sync_action: null }),
        createAttachment({ attachment_id: "2", synced: 0, sync_action: null }),
        createAttachment({ attachment_id: "3", synced: 1, sync_action: "delete" }),
      ];
      const result = getAttachmentsNeedingSync(attachments);
      expect(result).toHaveLength(2);
    });
  });

  describe("countAttachmentsInContent", () => {
    it("counts attachments in HTML", () => {
      const html = '<img data-attachment-id="1" /><img data-attachment-id="2" />';
      expect(countAttachmentsInContent(html)).toBe(2);
    });

    it("returns 0 for no attachments", () => {
      expect(countAttachmentsInContent("<p>No images</p>")).toBe(0);
    });
  });

  describe("validateAttachment", () => {
    it("returns invalid for missing entry_id", () => {
      const result = validateAttachment({ user_id: "u", file_path: "f", mime_type: "m" });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Entry ID is required");
    });

    it("returns invalid for missing user_id", () => {
      const result = validateAttachment({ entry_id: "e", file_path: "f", mime_type: "m" });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("User ID is required");
    });

    it("returns invalid for missing file path", () => {
      const result = validateAttachment({ entry_id: "e", user_id: "u", mime_type: "m" });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File path or local path is required");
    });

    it("returns invalid for missing mime_type", () => {
      const result = validateAttachment({ entry_id: "e", user_id: "u", file_path: "f" });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("MIME type is required");
    });

    it("returns valid for complete attachment with file_path", () => {
      const result = validateAttachment({
        entry_id: "e",
        user_id: "u",
        file_path: "f",
        mime_type: "m",
      });
      expect(result.valid).toBe(true);
    });

    it("returns valid for complete attachment with local_path", () => {
      const result = validateAttachment({
        entry_id: "e",
        user_id: "u",
        local_path: "l",
        mime_type: "m",
      });
      expect(result.valid).toBe(true);
    });
  });
});
