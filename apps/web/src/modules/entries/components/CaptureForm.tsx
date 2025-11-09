import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEntries, extractTagsAndMentions, getWordCount, getCharacterCount } from "@trace/core";

export function CaptureForm() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captureLocation, setCaptureLocation] = useState(true);
  const isLocalChange = useRef(false);

  const { entryMutations } = useEntries();

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
      },
    },
  });

  const handleSave = async () => {
    if (!editor) {
      console.log("No editor");
      return;
    }

    const content = editor.getHTML();
    const textContent = editor.getText().trim();

    console.log("Saving entry...", { content, textContent });

    // Check if there's actual text content (not just empty HTML)
    if (!textContent || textContent.length === 0) {
      console.log("No content to save");
      return;
    }

    setIsSubmitting(true);

    try {
      const { tags, mentions } = extractTagsAndMentions(content);

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
        category_id: null,
      });

      console.log("Entry created successfully");

      // Clear form
      setTitle("");
      editor.commands.setContent("");

      // Navigate to inbox
      navigate("/inbox");
    } catch (error) {
      console.error("Failed to create entry:", error);
      alert(`Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canIndent = editor?.can().sinkListItem("listItem") ?? false;
  const isInList = editor?.isActive("bulletList") || editor?.isActive("orderedList");

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
              <circle cx={12} cy={10} r={3} strokeWidth={2} />
            </svg>
          </button>

          {/* Category Button - placeholder */}
          <button
            className="p-2 rounded text-gray-400 hover:bg-gray-50 transition-colors"
            title="Add category"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
            </svg>
          </button>
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
  );
}
