import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEntry, extractTagsAndMentions, getWordCount, getCharacterCount, formatEntryDate } from "@trace/core";
import { RichTextEditor } from "../components/editor/RichTextEditor";

export function EntryEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { entry, isLoading, error, entryMutations, entryHelpers } = useEntry(id || null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Load entry data when it arrives
  useEffect(() => {
    if (entry) {
      setTitle(entry.title || "");
      setContent(entry.content);
    }
  }, [entry]);

  const wordCount = getWordCount(content);
  const charCount = getCharacterCount(content);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setErrorMessage("Content is required");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Extract tags and mentions from updated content
      const { tags, mentions } = extractTagsAndMentions(content);

      await entryMutations.updateEntry({
        title: title.trim() || null,
        content,
        tags,
        mentions,
      });

      setSuccessMessage("Entry updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Failed to update entry:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update entry"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this entry?")) {
      return;
    }

    try {
      await entryMutations.deleteEntry();
      navigate("/inbox");
    } catch (error) {
      console.error("Failed to delete entry:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete entry"
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSave(e as any);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Entry Not Found</h2>
          <p className="text-red-600">The entry you're looking for doesn't exist or you don't have permission to view it.</p>
          <button
            onClick={() => navigate("/inbox")}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Inbox
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Edit Entry</h1>
      </div>

      <form onSubmit={handleSave} onKeyDown={handleKeyDown} className="space-y-4">
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
            placeholder="Start typing..."
          />
        </div>

        {/* Metadata */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Created:</span>
            <span className="text-gray-900">{formatEntryDate(entry.created_at)}</span>
          </div>
          {entry.location_lat && entry.location_lng && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Location:</span>
              <span className="text-gray-900">
                {entry.location_lat.toFixed(4)}, {entry.location_lng.toFixed(4)}
              </span>
            </div>
          )}
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex justify-between items-start text-sm">
              <span className="text-gray-600">Tags:</span>
              <div className="flex gap-1 flex-wrap justify-end max-w-md">
                {entry.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
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

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Delete
          </button>
        </div>
      </form>
    </div>
  );
}
