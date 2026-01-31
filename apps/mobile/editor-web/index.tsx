import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdvancedEditor } from './AdvancedEditor';

// Wait for webview content injection before rendering
// The 10tap library sets window.initialContent before this runs
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<AdvancedEditor />);
}
