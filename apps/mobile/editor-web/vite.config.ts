import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  root: __dirname,
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  resolve: {
    alias: [
      // Use Preact instead of React (~100KB smaller)
      { find: 'react', replacement: 'preact/compat' },
      { find: 'react-dom', replacement: 'preact/compat' },
      { find: 'react/jsx-runtime', replacement: 'preact/jsx-runtime' },
      // TenTap web imports - redirect to web-specific bundle
      {
        find: '@10play/tentap-editor/web',
        replacement: path.resolve(__dirname, '../node_modules/@10play/tentap-editor/lib-web/index.mjs'),
      },
      // Tiptap PM packages - use TenTap's bundled versions
      { find: '@tiptap/pm/view', replacement: '@10play/tentap-editor/web' },
      { find: '@tiptap/pm/state', replacement: '@10play/tentap-editor/web' },
      // Core package for shared extensions
      {
        find: '@trace/core',
        replacement: path.resolve(__dirname, '../../../packages/core/src'),
      },
    ],
  },
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsxInject: `import { h, Fragment } from 'preact'`,
  },
  plugins: [viteSingleFile()],
});
