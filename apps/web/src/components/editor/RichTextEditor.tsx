import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  autoFocus = false,
}: RichTextEditorProps) {
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
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[200px] p-4",
      },
    },
  });

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Formatting Toolbar */}
      <div className="border-b bg-gray-50 p-2 flex gap-1 flex-wrap">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive("bold")
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Bold (Ctrl+B)"
        >
          B
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`px-3 py-1 rounded text-sm font-medium italic transition-colors ${
            editor.isActive("italic")
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Italic (Ctrl+I)"
        >
          I
        </button>

        <div className="w-px bg-gray-300 mx-1" />

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            editor.isActive("bulletList")
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
          title="Bullet List"
        >
          • List
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            editor.isActive("orderedList")
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
          title="Numbered List"
        >
          1. List
        </button>

        <div className="w-px bg-gray-300 mx-1" />

        <button
          onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
          disabled={!editor.can().sinkListItem("listItem")}
          className="px-3 py-1 rounded text-sm bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Indent (Tab)"
        >
          →
        </button>

        <button
          onClick={() => editor.chain().focus().liftListItem("listItem").run()}
          disabled={!editor.can().liftListItem("listItem")}
          className="px-3 py-1 rounded text-sm bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Outdent (Shift+Tab)"
        >
          ←
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}
