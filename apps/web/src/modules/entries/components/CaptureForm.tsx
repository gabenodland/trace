import { useState } from "react";
import { useEntries, extractTagsAndMentions, getWordCount, getCharacterCount } from "@trace/core";
import { RichTextEditor } from "../../../components/editor/RichTextEditor";

export function CaptureForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const { entryMutations, entryHelpers } = useEntries();

  const wordCount = getWordCount(content);
  const charCount = getCharacterCount(content);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setErrorMessage("Content is required");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Extract tags and mentions from content
      const { tags, mentions } = extractTagsAndMentions(content);

      // Get GPS coordinates if available
      let latitude: number | null = null;
      let longitude: number | null = null;
      let accuracy: number | null = null;

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
                maximumAge: 60000,
              });
            }
          );
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          accuracy = position.coords.accuracy; // Accuracy in meters
        } catch (geoError) {
          // Silently fail if location not available
          console.log("Location not available:", geoError);
        }
      }

      // Create entry
      await entryMutations.createEntry({
        title: title.trim() || null,
        content,
        tags,
        mentions,
        location_lat: latitude,
        location_lng: longitude,
        location_accuracy: accuracy,
        category_id: null, // Inbox for now
      });

      // Success - clear form
      setTitle("");
      setContent("");
      setSuccessMessage("Entry saved successfully!");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to create entry:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save entry"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSubmit(e as any);
    }
  };

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
      {/* Title Input */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title (optional)
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a title..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSubmitting}
        />
      </div>

      {/* Rich Text Editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="Start typing... Use #tags and @mentions"
          autoFocus
        />
      </div>

      {/* Character/Word Count */}
      <div className="flex justify-between items-center text-sm text-gray-500">
        <div>
          {wordCount} {wordCount === 1 ? "word" : "words"} • {charCount}{" "}
          {charCount === 1 ? "character" : "characters"}
        </div>
        <div className="text-xs text-gray-400">
          Press Ctrl+Enter to save
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Saving..." : "Save to Inbox"}
        </button>

        <button
          type="button"
          onClick={() => {
            setTitle("");
            setContent("");
            setErrorMessage("");
            setSuccessMessage("");
          }}
          disabled={isSubmitting}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
