/**
 * EntryPickers - All picker modals for EntryScreen
 * Extracted from EntryScreen for maintainability
 */

import { useEffect } from "react";
import type { Stream, Location as LocationType, EntryStatus } from "@trace/core";
import { applyTitleTemplate, applyContentTemplate } from "@trace/core";
import { useNavigation } from "../../../shared/contexts/NavigationContext";
import { StreamPicker } from "../../streams/components/StreamPicker";
import { LocationPicker } from "../../locations/components/LocationPicker";
import {
  RatingPicker,
  WholeNumberRatingPicker,
  DecimalRatingPicker,
  PriorityPicker,
  TimePicker,
  AttributesPicker,
  StatusPicker,
  DueDatePicker,
  EntryDatePicker,
  TypePicker,
  UnsupportedAttributePicker,
} from "./pickers";
import type { CaptureFormData } from "./context/EntryFormContext";

// Picker types - GPS picker removed, unified into location
export type ActivePicker =
  | "stream"
  | "location"
  | "dueDate"
  | "rating"
  | "priority"
  | "status"
  | "type"
  | "attributes"
  | "entryDate"
  | "time"
  | "unsupportedStatus"
  | "unsupportedType"
  | "unsupportedDueDate"
  | "unsupportedRating"
  | "unsupportedPriority"
  | "unsupportedLocation"
  | null;

export interface EntryPickersProps {
  // Picker state
  activePicker: ActivePicker;
  setActivePicker: (picker: ActivePicker) => void;

  // Form data
  formData: CaptureFormData;
  updateField: <K extends keyof CaptureFormData>(field: K, value: CaptureFormData[K]) => void;

  // Mode flags
  isEditing: boolean;
  isEditMode: boolean;

  // Stream data
  streams: Stream[];
  currentStream: Stream | null;

  // Feature visibility flags
  showLocation: boolean;
  showStatus: boolean;
  showType: boolean;
  showDueDate: boolean;
  showRating: boolean;
  showPriority: boolean;
  showPhotos: boolean;

  // Photo count
  photoCount: number;

  // Location picker mode
  locationPickerMode: "select" | "create" | "view";

  // Callbacks
  showSnackbar: (message: string) => void;
  handleDelete: () => void;
  onAddPhoto: () => void;
}

export function EntryPickers({
  activePicker,
  setActivePicker,
  formData,
  updateField,
  isEditing,
  isEditMode,
  streams,
  currentStream,
  showLocation,
  showStatus,
  showType,
  showDueDate,
  showRating,
  showPriority,
  showPhotos,
  photoCount,
  locationPickerMode,
  showSnackbar,
  handleDelete,
  onAddPhoto,
}: EntryPickersProps) {
  const { setIsModalOpen } = useNavigation();

  // Track fullscreen modals (disables swipe-back gesture)
  // Note: We don't dismiss keyboard - pickers should appear over it to avoid disrupting typing flow
  useEffect(() => {
    const isFullscreenModal = activePicker === "location" || activePicker === "stream";
    setIsModalOpen(isFullscreenModal);
    return () => setIsModalOpen(false);
  }, [activePicker, setIsModalOpen]);

  return (
    <>
      {/* Stream Picker Dropdown - only render when active to avoid unnecessary hook calls */}
      {activePicker === "stream" && (
        <StreamPicker
          visible={true}
          onClose={() => setActivePicker(null)}
          isNewEntry={!isEditing}
          onSelect={(id, name) => {
            const hadStream = !!formData.streamId;
            const isRemoving = !id;
            updateField("streamId", id);
            updateField("streamName", name);

            // Apply templates when stream is selected (not removed)
            if (id) {
              const selectedStream = streams.find((s) => s.stream_id === id);

              if (selectedStream) {
                const templateDate = new Date();
                const titleIsBlank = !formData.title.trim();
                const contentIsBlank = !formData.content.trim();

                // Apply title template if title is blank (independent of content)
                if (titleIsBlank && selectedStream.entry_title_template) {
                  const newTitle = applyTitleTemplate(
                    selectedStream.entry_title_template,
                    {
                      date: templateDate,
                      streamName: selectedStream.name,
                    }
                  );
                  if (newTitle) {
                    updateField("title", newTitle);
                  }
                }

                // Apply content template if content is blank (independent of title)
                if (contentIsBlank && selectedStream.entry_content_template) {
                  const newContent = applyContentTemplate(
                    selectedStream.entry_content_template,
                    {
                      date: templateDate,
                      streamName: selectedStream.name,
                    }
                  );
                  if (newContent) {
                    updateField("content", newContent);
                  }
                }

                // Apply default status if current status is "none"
                if (
                  formData.status === "none" &&
                  selectedStream.entry_use_status &&
                  selectedStream.entry_default_status
                ) {
                  updateField("status", selectedStream.entry_default_status);
                }
              }
            }

            if (isRemoving && hadStream) {
              showSnackbar("You removed the stream");
            } else if (hadStream) {
              showSnackbar("Success! You updated the stream.");
            } else {
              showSnackbar("Success! You added the stream.");
            }
          }}
          selectedStreamId={formData.streamId}
        />
      )}

      {/* Location Picker (fullscreen modal) - handles all location states */}
      {activePicker === "location" && (
        <LocationPicker
          visible={true}
          onClose={() => setActivePicker(null)}
          mode={locationPickerMode}
          onSelect={(location: LocationType | null) => {
            if (location === null) {
              updateField("locationData", null);
              setActivePicker(null);
              showSnackbar("You removed the location");
              return;
            }

            const isUpdating = !!formData.locationData?.name;
            updateField("locationData", location);

            setActivePicker(null);
            showSnackbar(
              isUpdating
                ? "Success! You updated the location."
                : "Success! You added the location."
            );
          }}
          initialLocation={
            formData.locationData
              ? {
                  location_id: formData.locationData.location_id, // Pass location_id if linked to saved location
                  latitude: formData.locationData.latitude,
                  longitude: formData.locationData.longitude,
                  name: formData.locationData.name,
                  source: "user_custom",
                  address: formData.locationData.address,
                  neighborhood: formData.locationData.neighborhood,
                  city: formData.locationData.city,
                  region: formData.locationData.region,
                  country: formData.locationData.country,
                  postalCode: formData.locationData.postalCode,
                  subdivision: formData.locationData.subdivision,
                  locationRadius: formData.locationData.locationRadius, // Location radius for precision circle on map
                }
              : null
          }
        />
      )}

      {/* Due Date Picker Modal */}
      <DueDatePicker
        visible={activePicker === "dueDate"}
        onClose={() => setActivePicker(null)}
        dueDate={formData.dueDate}
        onDueDateChange={(date) => updateField("dueDate", date)}
        onSnackbar={showSnackbar}
      />

      {/* Entry Date Picker */}
      <EntryDatePicker
        visible={activePicker === "entryDate"}
        onClose={() => setActivePicker(null)}
        entryDate={formData.entryDate}
        onEntryDateChange={(date) => updateField("entryDate", date)}
        onSnackbar={showSnackbar}
      />

      {/* Time Picker Modal */}
      <TimePicker
        visible={activePicker === "time"}
        onClose={() => setActivePicker(null)}
        entryDate={formData.entryDate}
        onEntryDateChange={(date) => updateField("entryDate", date)}
        onIncludeTimeChange={(include) => updateField("includeTime", include)}
        onSnackbar={showSnackbar}
        includeTime={formData.includeTime}
      />

      {/* Rating Picker Modal - switch based on stream config */}
      {currentStream?.entry_rating_type === "decimal" ? (
        <DecimalRatingPicker
          visible={activePicker === "rating"}
          onClose={() => setActivePicker(null)}
          rating={formData.rating}
          onRatingChange={(value) => updateField("rating", value)}
          onSnackbar={showSnackbar}
        />
      ) : currentStream?.entry_rating_type === "decimal_whole" ? (
        <WholeNumberRatingPicker
          visible={activePicker === "rating"}
          onClose={() => setActivePicker(null)}
          rating={formData.rating}
          onRatingChange={(value) => updateField("rating", value)}
          onSnackbar={showSnackbar}
        />
      ) : (
        <RatingPicker
          visible={activePicker === "rating"}
          onClose={() => setActivePicker(null)}
          rating={formData.rating}
          onRatingChange={(value) => updateField("rating", value)}
          onSnackbar={showSnackbar}
        />
      )}

      {/* Priority Picker Modal */}
      <PriorityPicker
        visible={activePicker === "priority"}
        onClose={() => setActivePicker(null)}
        priority={formData.priority}
        onPriorityChange={(value) => updateField("priority", value)}
        onSnackbar={showSnackbar}
      />

      {/* Status Picker Modal */}
      <StatusPicker
        visible={activePicker === "status"}
        onClose={() => setActivePicker(null)}
        status={formData.status}
        onStatusChange={(value) => {
          updateField("status", value);
        }}
        onSnackbar={showSnackbar}
        allowedStatuses={currentStream?.entry_statuses}
      />

      {/* Type Picker Modal */}
      <TypePicker
        visible={activePicker === "type"}
        onClose={() => setActivePicker(null)}
        type={formData.type}
        onTypeChange={(value) => {
          updateField("type", value);
        }}
        onSnackbar={showSnackbar}
        availableTypes={currentStream?.entry_types ?? []}
      />

      {/* Unsupported Attribute Pickers */}
      <UnsupportedAttributePicker
        visible={activePicker === "unsupportedStatus"}
        onClose={() => setActivePicker(null)}
        attributeName="Status"
        currentValue={
          formData.status === "none"
            ? "None"
            : formData.status.charAt(0).toUpperCase() + formData.status.slice(1)
        }
        onRemove={() => {
          updateField("status", "none");
        }}
        onSnackbar={showSnackbar}
      />

      <UnsupportedAttributePicker
        visible={activePicker === "unsupportedType"}
        onClose={() => setActivePicker(null)}
        attributeName="Type"
        currentValue={formData.type || ""}
        onRemove={() => {
          updateField("type", null);
        }}
        onSnackbar={showSnackbar}
      />

      <UnsupportedAttributePicker
        visible={activePicker === "unsupportedDueDate"}
        onClose={() => setActivePicker(null)}
        attributeName="Due Date"
        currentValue={
          formData.dueDate
            ? new Date(formData.dueDate).toLocaleDateString()
            : ""
        }
        onRemove={() => {
          updateField("dueDate", null);
        }}
        onSnackbar={showSnackbar}
      />

      <UnsupportedAttributePicker
        visible={activePicker === "unsupportedRating"}
        onClose={() => setActivePicker(null)}
        attributeName="Rating"
        currentValue={`${formData.rating} star${formData.rating !== 1 ? "s" : ""}`}
        onRemove={() => {
          updateField("rating", 0);
        }}
        onSnackbar={showSnackbar}
      />

      <UnsupportedAttributePicker
        visible={activePicker === "unsupportedPriority"}
        onClose={() => setActivePicker(null)}
        attributeName="Priority"
        currentValue={
          formData.priority === 1
            ? "Low"
            : formData.priority === 2
            ? "Medium"
            : "High"
        }
        onRemove={() => {
          updateField("priority", 0);
        }}
        onSnackbar={showSnackbar}
      />

      <UnsupportedAttributePicker
        visible={activePicker === "unsupportedLocation"}
        onClose={() => setActivePicker(null)}
        attributeName="Location"
        currentValue={formData.locationData?.name || "Unknown Location"}
        onRemove={() => {
          updateField("locationData", null);
        }}
        onSnackbar={showSnackbar}
      />

      {/* Entry Menu */}
      <AttributesPicker
        visible={activePicker === "attributes"}
        onClose={() => setActivePicker(null)}
        isEditing={isEditing}
        isEditMode={isEditMode}
        showLocation={showLocation}
        showStatus={showStatus}
        showType={showType}
        showDueDate={showDueDate}
        showRating={showRating}
        showPriority={showPriority}
        showPhotos={showPhotos}
        hasLocationData={!!(formData.locationData?.latitude || formData.locationData?.name)}
        status={formData.status}
        type={formData.type}
        dueDate={formData.dueDate}
        rating={formData.rating}
        priority={formData.priority}
        photoCount={photoCount}
        onShowLocationPicker={() => setActivePicker("location")}
        onShowStatusPicker={() => setActivePicker("status")}
        onShowTypePicker={() => setActivePicker("type")}
        onShowDatePicker={() => setActivePicker("dueDate")}
        onShowRatingPicker={() => setActivePicker("rating")}
        onShowPriorityPicker={() => setActivePicker("priority")}
        onAddPhoto={onAddPhoto}
        onDelete={handleDelete}
        onSnackbar={showSnackbar}
      />
    </>
  );
}
