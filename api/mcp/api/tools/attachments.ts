// Attachment operations for MCP
// Generates signed URLs and fetches attachment data for inline display

import type { ToolContext } from "./mod";

// Maximum file size to fetch inline (5MB)
const MAX_INLINE_FILE_SIZE = 5 * 1024 * 1024;

// ============================================================================
// Attachment Types
// ============================================================================

interface GetAttachmentUrlParams {
  attachment_id: string;
}

interface GetAttachmentDataParams {
  attachment_id: string;
}

interface AttachmentRow {
  attachment_id: string;
  entry_id: string;
  user_id: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  position: number;
  captured_at: string;
  created_at: string;
}

// ============================================================================
// Tool Handlers
// ============================================================================

// Signed URL expiry time: 1 hour
const SIGNED_URL_EXPIRY_SECONDS = 3600;

/**
 * Get a signed URL for accessing an attachment
 */
export async function getAttachmentUrl(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as GetAttachmentUrlParams;

  if (!p?.attachment_id) {
    throw new Error("attachment_id is required");
  }

  // First, verify the attachment exists and belongs to the user
  const { data: attachment, error: attachmentError } = await ctx.supabase
    .from("attachments")
    .select("*")
    .eq("attachment_id", p.attachment_id)
    .eq("user_id", ctx.userId) // Security: ensure user owns attachment
    .single();

  if (attachmentError) {
    if (attachmentError.code === "PGRST116") {
      throw new Error("Attachment not found or not owned by user");
    }
    throw new Error(`Failed to get attachment: ${attachmentError.message}`);
  }

  const typedAttachment = attachment as AttachmentRow;

  // Generate signed URL for the file
  const { data: signedUrlData, error: signedUrlError } = await ctx.supabase
    .storage
    .from("attachments")
    .createSignedUrl(typedAttachment.file_path, SIGNED_URL_EXPIRY_SECONDS);

  if (signedUrlError) {
    throw new Error(`Failed to generate signed URL: ${signedUrlError.message}`);
  }

  return {
    attachment_id: typedAttachment.attachment_id,
    entry_id: typedAttachment.entry_id,
    url: signedUrlData.signedUrl,
    expires_in_seconds: SIGNED_URL_EXPIRY_SECONDS,
    mime_type: typedAttachment.mime_type,
    file_size: typedAttachment.file_size,
    dimensions: typedAttachment.width && typedAttachment.height
      ? {
          width: typedAttachment.width,
          height: typedAttachment.height,
        }
      : null,
    captured_at: typedAttachment.captured_at,
  };
}

/**
 * Get attachment data as base64 for inline display in Claude
 * Returns the image data directly so Claude can see it
 */
export async function getAttachmentData(
  params: unknown,
  ctx: ToolContext
): Promise<unknown> {
  const p = params as GetAttachmentDataParams;

  if (!p?.attachment_id) {
    throw new Error("attachment_id is required");
  }

  // First, verify the attachment exists and belongs to the user
  const { data: attachment, error: attachmentError } = await ctx.supabase
    .from("attachments")
    .select("*")
    .eq("attachment_id", p.attachment_id)
    .eq("user_id", ctx.userId) // Security: ensure user owns attachment
    .single();

  if (attachmentError) {
    if (attachmentError.code === "PGRST116") {
      throw new Error("Attachment not found or not owned by user");
    }
    throw new Error(`Failed to get attachment: ${attachmentError.message}`);
  }

  const typedAttachment = attachment as AttachmentRow;

  // Check file size limit
  if (typedAttachment.file_size > MAX_INLINE_FILE_SIZE) {
    throw new Error(
      `File too large for inline display (${Math.round(typedAttachment.file_size / 1024 / 1024)}MB). ` +
      `Maximum size is ${MAX_INLINE_FILE_SIZE / 1024 / 1024}MB. Use get_attachment_url instead.`
    );
  }

  // Download the file from storage
  const { data: fileData, error: downloadError } = await ctx.supabase
    .storage
    .from("attachments")
    .download(typedAttachment.file_path);

  if (downloadError) {
    throw new Error(`Failed to download attachment: ${downloadError.message}`);
  }

  // Convert to base64
  const arrayBuffer = await fileData.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64Data = btoa(binary);

  // Return in MCP image format - this will be converted to proper content block
  return {
    _type: "image",
    attachment_id: typedAttachment.attachment_id,
    entry_id: typedAttachment.entry_id,
    mime_type: typedAttachment.mime_type,
    data: base64Data,
    file_size: typedAttachment.file_size,
    dimensions: typedAttachment.width && typedAttachment.height
      ? {
          width: typedAttachment.width,
          height: typedAttachment.height,
        }
      : null,
    captured_at: typedAttachment.captured_at,
  };
}
