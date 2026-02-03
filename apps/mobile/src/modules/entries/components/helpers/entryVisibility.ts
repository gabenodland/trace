import type { Stream } from "@trace/core";
import type { EntryStatus, Location as LocationType } from "@trace/core";

/**
 * Visibility flags for entry form fields based on stream configuration.
 * If no stream is selected, all fields are shown by default.
 */
export interface EntryFieldVisibility {
  showRating: boolean;
  showPriority: boolean;
  showStatus: boolean;
  showType: boolean;
  showDueDate: boolean;
  showLocation: boolean;
  showPhotos: boolean;
}

/**
 * Flags indicating fields that have values but are not supported by the current stream.
 * Used to show strikethrough styling with option to clear the value.
 */
export interface UnsupportedFieldFlags {
  unsupportedRating: boolean;
  unsupportedPriority: boolean;
  unsupportedStatus: boolean;
  unsupportedType: boolean;
  unsupportedDueDate: boolean;
  unsupportedLocation: boolean;
}

/**
 * Computes which entry fields should be visible based on stream configuration.
 *
 * Rules:
 * - No stream selected → show all fields (default behavior)
 * - Stream selected → show only fields enabled in stream settings
 * - Type field has additional requirement: entry_types array must have items
 *
 * @param stream - The current stream, or null/undefined if no stream selected
 */
export function getEntryFieldVisibility(stream: Stream | null | undefined): EntryFieldVisibility {
  // No stream = show all fields
  if (!stream) {
    return {
      showRating: true,
      showPriority: true,
      showStatus: true,
      showType: false, // Types require explicit configuration
      showDueDate: true,
      showLocation: true,
      showPhotos: true,
    };
  }

  return {
    showRating: stream.entry_use_rating === true,
    showPriority: stream.entry_use_priority === true,
    showStatus: stream.entry_use_status !== false,
    showType: stream.entry_use_type === true && (stream.entry_types?.length ?? 0) > 0,
    showDueDate: stream.entry_use_duedates === true,
    showLocation: stream.entry_use_location !== false,
    showPhotos: stream.entry_use_photos !== false,
  };
}

/**
 * Computes which fields have values but are not supported by the current stream.
 * These are shown with strikethrough styling in the UI.
 *
 * @param visibility - Field visibility flags from getEntryFieldVisibility
 * @param formData - Current form values to check against
 */
export function getUnsupportedFieldFlags(
  visibility: EntryFieldVisibility,
  formData: {
    status: EntryStatus;
    type: string | null;
    dueDate: string | null;
    rating: number;
    priority: number;
    locationData: LocationType | null;
  }
): UnsupportedFieldFlags {
  return {
    unsupportedStatus: !visibility.showStatus && formData.status !== "none",
    unsupportedType: !visibility.showType && !!formData.type,
    unsupportedDueDate: !visibility.showDueDate && !!formData.dueDate,
    unsupportedRating: !visibility.showRating && formData.rating > 0,
    unsupportedPriority: !visibility.showPriority && formData.priority > 0,
    unsupportedLocation: !visibility.showLocation && !!formData.locationData,
  };
}
