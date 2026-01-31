import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'editor-web',
  build: {
    outDir: 'build',
    emptyOutDir: false,
  },
  resolve: {
    alias: [
      {
        find: '@10play/tentap-editor',
        replacement: '@10play/tentap-editor/web',
      },
      { find: '@tiptap/pm/view', replacement: '@10play/tentap-editor/web' },
      { find: '@tiptap/pm/state', replacement: '@10play/tentap-editor/web' },
    ],
  },
  plugins: [react(), viteSingleFile()],
});
