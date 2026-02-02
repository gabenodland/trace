/**
 * Generates a JS module from the built editor HTML
 * Uses JSON.stringify for proper escaping (same approach as TenTap's buildEditor.js)
 */

const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const htmlPath = path.join(buildDir, 'index.html');
const outputPath = path.join(buildDir, 'editorHtml.js');

// Read the built HTML
const html = fs.readFileSync(htmlPath, 'utf-8');

// Generate JS module using JSON.stringify for proper escaping
// This matches how TenTap's official buildEditor.js works
const jsModule = `// @ts-nocheck
/* eslint-disable */
// Auto-generated - do not edit
// Run: npm run editor:build
export const editorHtml = ${JSON.stringify(html)};
`;

fs.writeFileSync(outputPath, jsModule);

// Create type declaration file
const dtsPath = outputPath.replace('.js', '.d.ts');
fs.writeFileSync(dtsPath, 'export declare const editorHtml: string;\n');

console.log('Generated:', outputPath);
