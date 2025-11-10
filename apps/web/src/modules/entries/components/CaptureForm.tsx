import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEntries, useEntry, useCategories, extractTagsAndMentions, getWordCount, getCharacterCount } from "@trace/core";
import { CategoryPicker } from "../../categories/components/CategoryPicker";

export function CaptureForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entryId = searchParams.get('id');

  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captureLocation, setCaptureLocation] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [status, setStatus] = useState<"none" | "incomplete" | "complete">("none");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isLocalChange = useRef(false);

  const { entryMutations } = useEntries();
  const { entry, isLoading: isLoadingEntry, entryMutations: singleEntryMutations } = useEntry(entryId);
  const { categories } = useCategories();

  const isEditing = !!entryId;

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder: "What's on your mind? Use #tags and @mentions...",
      }),
    ],
    content: "",
    autofocus: "end",
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none min-h-[60vh] px-6 py-4",
        spellcheck: "true",
      },
    },
  });

  // Load entry data when editing
  useEffect(() => {
    if (entry && isEditing && editor) {
      setTitle(entry.title || "");
      editor.commands.setContent(entry.content);
      setCategoryId(entry.category_id || null);
      setStatus(entry.status);
      setDueDate(entry.due_date);

      // Look up category name from categories list
      if (entry.category_id && categories.length > 0) {
        const category = categories.find(c => c.category_id === entry.category_id);
        setCategoryName(category?.name || null);
      } else {
        setCategoryName(null);
      }

      // Set location if available
      if (entry.location_lat && entry.location_lng) {
        setCaptureLocation(true);
      }
    }
  }, [entry, isEditing, editor, categories]);

  const handleSave = async () => {
    if (!editor) {
      console.log("No editor");
      return;
    }

    const content = editor.getHTML();
    const textContent = editor.getText().trim();

    console.log("Saving entry...", { content, textContent, isEditing });

    // Check if there's actual text content (not just empty HTML)
    if (!textContent || textContent.length === 0) {
      console.log("No content to save");
      alert("Please add some content before saving");
      return;
    }

    setIsSubmitting(true);

    try {
      const { tags, mentions } = extractTagsAndMentions(content);

      if (isEditing) {
        // Update existing entry
        console.log("Updating entry...");
        await singleEntryMutations.updateEntry({
          title: title.trim() || null,
          content,
          tags,
          mentions,
          category_id: categoryId,
          status,
          due_date: dueDate,
        });
        console.log("Entry updated successfully");
      } else {
        // Create new entry
        // Get GPS coordinates if available and enabled
        let latitude: number | null = null;
        let longitude: number | null = null;
        let accuracy: number | null = null;

        if (captureLocation && navigator.geolocation) {
          try {
            const position = await new Promise<GeolocationPosition>(
              (resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  timeout: 2000,
                  maximumAge: 60000,
                });
              }
            );
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
            accuracy = position.coords.accuracy;
          } catch (geoError) {
            console.log("Location not available:", geoError);
          }
        }

        console.log("Creating entry...");
        await entryMutations.createEntry({
          title: title.trim() || null,
          content,
          tags,
          mentions,
          location_lat: latitude,
          location_lng: longitude,
          location_accuracy: accuracy,
          category_id: categoryId,
          status,
          due_date: dueDate,
        });
        console.log("Entry created successfully");

        // Clear form only when creating
        setTitle("");
        editor.commands.setContent("");
        setCategoryId(null);
        setCategoryName(null);
        setStatus("none");
        setDueDate(null);
      }

      // Navigate to inbox
      navigate("/inbox");
    } catch (error) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} entry:`, error);
      alert(`Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handler (only for editing)
  const handleDelete = async () => {
    if (!isEditing) return;

    if (!window.confirm("Are you sure you want to delete this entry?")) {
      return;
    }

    try {
      await singleEntryMutations.deleteEntry();
      navigate("/inbox");
    } catch (error) {
      console.error("Failed to delete entry:", error);
      alert(`Failed to delete: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const canIndent = editor?.can().sinkListItem("listItem") ?? false;
  const isInList = editor?.isActive("bulletList") || editor?.isActive("orderedList");

  // Show loading when editing and entry is loading
  if (isEditing && isLoadingEntry) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading entry...</p>
        </div>
      </div>
    );
  }

  // Show error if editing and entry not found
  if (isEditing && !entry) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">Entry not found</p>
          <button
            onClick={() => navigate("/inbox")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Inbox
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <div className="flex items-center gap-4">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Date/Time */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx={12} cy={12} r={10} strokeWidth={2} />
              <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
            </svg>
            <span>{currentDate}</span>
          </div>

          {/* Location Toggle */}
          <button
            onClick={() => setCaptureLocation(!captureLocation)}
            className={`p-2 rounded transition-colors ${
              captureLocation ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:bg-gray-50"
            }`}
            title={captureLocation ? "Location enabled" : "Location disabled"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              <circle
                cx={12}
                cy={10}
                r={3}
                strokeWidth={2}
                fill={captureLocation ? "currentColor" : "none"}
                className={captureLocation ? "animate-pulse" : ""}
              />
            </svg>
          </button>

          {/* Category Button - with relative positioning for dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowCategoryPicker(!showCategoryPicker)}
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                categoryId ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:bg-gray-50"
              }`}
              title={categoryName || "Inbox"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
              <span className="text-sm font-medium">{categoryName || "Inbox"}</span>
            </button>

            {/* Category Picker Dropdown */}
            <CategoryPicker
              visible={showCategoryPicker}
              onClose={() => setShowCategoryPicker(false)}
              onSelect={(id, name) => {
                setCategoryId(id);
                setCategoryName(name);
              }}
              selectedCategoryId={categoryId}
            />
          </div>

          {/* Task Status Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setStatus("none")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                status === "none"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Note (no task)"
            >
              Note
            </button>
            <button
              onClick={() => setStatus("incomplete")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                status === "incomplete"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Task - incomplete"
            >
              Task
            </button>
            <button
              onClick={() => {
                setStatus(status === "complete" ? "incomplete" : "complete");
              }}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                status === "complete"
                  ? "bg-white text-green-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Task - complete"
            >
              Done
            </button>
          </div>

          {/* Due Date Picker */}
          {(status === "incomplete" || status === "complete" || dueDate) && (
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                  dueDate ? "bg-orange-50 text-orange-600" : "text-gray-400 hover:bg-gray-50"
                }`}
                title={dueDate ? `Due: ${new Date(dueDate).toLocaleDateString()}` : "Set due date"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
                  <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} />
                  <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} />
                  <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
                </svg>
                <span className="text-sm font-medium">
                  {dueDate ? new Date(dueDate).toLocaleDateString() : "Due date"}
                </span>
                {dueDate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDueDate(null);
                    }}
                    className="ml-1 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </button>

              {/* Date Picker Dropdown */}
              {showDatePicker && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 min-w-[280px]">
                  <input
                    type="date"
                    value={dueDate ? dueDate.split('T')[0] : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        // Convert to ISO string with time at start of day
                        const date = new Date(e.target.value);
                        date.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
                        setDueDate(date.toISOString());
                      } else {
                        setDueDate(null);
                      }
                      setShowDatePicker(false);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      onClick={() => {
                        const today = new Date();
                        today.setHours(12, 0, 0, 0);
                        setDueDate(today.toISOString());
                        setShowDatePicker(false);
                      }}
                      className="text-sm text-left px-3 py-2 rounded hover:bg-gray-100 transition-colors"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(12, 0, 0, 0);
                        setDueDate(tomorrow.toISOString());
                        setShowDatePicker(false);
                      }}
                      className="text-sm text-left px-3 py-2 rounded hover:bg-gray-100 transition-colors"
                    >
                      Tomorrow
                    </button>
                    <button
                      onClick={() => {
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        nextWeek.setHours(12, 0, 0, 0);
                        setDueDate(nextWeek.toISOString());
                        setShowDatePicker(false);
                      }}
                      className="text-sm text-left px-3 py-2 rounded hover:bg-gray-100 transition-colors"
                    >
                      Next week
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Title Input */}
      <div className="px-6 pt-6 pb-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full text-3xl font-semibold text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent"
          disabled={isSubmitting}
        />
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Floating Toolbar */}
      <div className="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Bold */}
          <button
            onClick={() => editor?.chain().focus().toggleBold().run()}
            disabled={!editor?.can().chain().focus().toggleBold().run()}
            className={`p-2 rounded transition-colors ${
              editor?.isActive("bold")
                ? "bg-blue-100 text-blue-600"
                : "text-gray-600 hover:bg-gray-100"
            } disabled:opacity-30`}
            title="Bold (Ctrl+B)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
            </svg>
          </button>

          {/* Italic */}
          <button
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            disabled={!editor?.can().chain().focus().toggleItalic().run()}
            className={`p-2 rounded transition-colors ${
              editor?.isActive("italic")
                ? "bg-blue-100 text-blue-600"
                : "text-gray-600 hover:bg-gray-100"
            } disabled:opacity-30`}
            title="Italic (Ctrl+I)"
          >
            <svg className="w-5 h-5 italic" fill="currentColor" viewBox="0 0 24 24">
              <text x="6" y="18" fontSize="16" fontStyle="italic">I</text>
            </svg>
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Bullet List */}
          <button
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded transition-colors ${
              editor?.isActive("bulletList")
                ? "bg-blue-100 text-blue-600"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            title="Bullet List"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <line x1="9" y1="6" x2="20" y2="6" strokeWidth={2} strokeLinecap="round" />
              <line x1="9" y1="12" x2="20" y2="12" strokeWidth={2} strokeLinecap="round" />
              <line x1="9" y1="18" x2="20" y2="18" strokeWidth={2} strokeLinecap="round" />
              <circle cx="5" cy="6" r="1" fill="currentColor" />
              <circle cx="5" cy="12" r="1" fill="currentColor" />
              <circle cx="5" cy="18" r="1" fill="currentColor" />
            </svg>
          </button>

          {/* Indent - only show if in list and can indent */}
          {isInList && canIndent && (
            <button
              onClick={() => editor?.chain().focus().sinkListItem("listItem").run()}
              className="p-2 rounded text-gray-600 hover:bg-gray-100 transition-colors"
              title="Indent (Tab)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          )}
        </div>

        {/* Word/Character Count */}
        <div className="text-sm text-gray-500">
          {getWordCount(editor?.getHTML() || "")} {getWordCount(editor?.getHTML() || "") === 1 ? "word" : "words"} • {getCharacterCount(editor?.getHTML() || "")} {getCharacterCount(editor?.getHTML() || "") === 1 ? "character" : "characters"}
        </div>

        <div className="flex items-center gap-2">
          {/* Delete Button (only when editing) */}
          {isEditing && (
            <button
              onClick={handleDelete}
              disabled={isSubmitting}
              className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              title="Delete Entry"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            title="Save (Ctrl+Enter)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
