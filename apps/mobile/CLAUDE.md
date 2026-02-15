# Mobile App (`apps/mobile`)

React Native / Expo mobile application.

---

## 📱 Android Build Configuration

### Dev Build vs Release APK

We use **Expo dev builds** (not Expo Go). Two builds run side-by-side:

| Build | Package ID | Icon | Purpose |
|-------|------------|------|---------|
| Debug | `com.trace.app.dev` | Orange debug icon | Dev with tunnel/local server |
| Release | `com.trace.app` | Normal icon | Standalone production |

### Build Commands

```bash
# Dev build (requires prebuild first)
npm run android              # prebuild:android + expo run:android

# Prebuild only (regenerates android/ folder)
npm run prebuild:android     # expo prebuild + addDebugAppId script

# Release APK (after prebuild)
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# Full release (auto-increments build number)
npm run build:release        # incrementBuildNumber → prebuild → assembleRelease
```

### Side-by-Side Installation

`scripts/addDebugAppId.js` runs after every prebuild:
1. Adds `applicationIdSuffix ".dev"` to debug builds
2. Installs debug icon from `assets/adaptive-icon-debug.png`

### Cache Clearing

When images/assets don't update:
```bash
rm -rf android/app/build android/app/.cxx android/.gradle
npm run prebuild:android && npm run android
```

### Running with Tunnel

```bash
npm run dev    # expo start --tunnel
# Press 'a' for Android, or scan QR
```

### Network Security Config

Dev builds need cleartext traffic. `plugins/withNetworkSecurityConfig.js` handles this automatically.

### Google Maps API Key

Configured in both `app.json` and `app.config.js`:
- iOS: `expo.ios.config.googleMapsApiKey`
- Android: `expo.android.config.googleMaps.apiKey`

### Key Files

| File | Purpose |
|------|---------|
| `app.config.js` | Main Expo config (JS, dynamic) |
| `app.json` | Static Expo config |
| `scripts/addDebugAppId.js` | Post-prebuild: .dev suffix + debug icon |
| `plugins/withNetworkSecurityConfig.js` | Network security for dev builds |
| `plugins/withMonorepoRoot.js` | Fixes Metro bundler for monorepo |
| `plugins/withReleaseSigning.js` | Release signing config |

---

## 📦 App Versioning

### Semantic Versioning

`MAJOR.MINOR.PATCH` — incremented manually for meaningful releases.

| Component | When | Example |
|-----------|------|---------|
| MAJOR | Breaking changes, major rewrites | 1.0.0 → 2.0.0 |
| MINOR | New features (backwards compatible) | 1.0.0 → 1.1.0 |
| PATCH | Bug fixes, small tweaks | 1.0.0 → 1.0.1 |

### Build Numbers

Auto-incremented on release builds, separate from version.

- **Version** in `app.config.js` (manual)
- **Build number** in `build-number.json` (auto via `scripts/incrementBuildNumber.js`)
- Displayed in Settings > About

### Server-Side Version Tracking

**`app_config`** table stores `minimum_version`, `latest_version`, update URLs.
**`app_sessions`** table tracks `app_version`, `build_number`, `platform`, `device_model`.

Enables force updates and version adoption analytics.

### Key Files

| File | Purpose |
|------|---------|
| `app.config.js` | Version and build number config |
| `build-number.json` | Current build number |
| `scripts/incrementBuildNumber.js` | Auto-increment build number |
| `src/config/appVersionService.ts` | Version checking + session logging |

---

## ✏️ Custom Rich Text Editor

Tiptap editor with title-first schema running inside TenTap's WebView.

### Architecture

```
React Native (RichTextEditor.tsx)
  └─ useEditorBridge({ customSource: editorHtml })
       └─ TenTap RichText WebView
            └─ Custom HTML bundle (editor-web/)
```

### Title-First Schema

Document structure: exactly one `<h1>` title node first, then body blocks.

**Title behavior:**
- No formatting marks (bold/italic blocked)
- Backspace at start blocked
- Enter moves to body, Shift+Enter blocked
- Plain text only

### Build

```bash
npm run editor:build
# Output: editor-web/build/editorHtml.js
```

**Rebuild when:** modifying `editor-web/index.tsx`, `editor-web/index.html`, or Title extensions in `@trace/core`.

The bundle is NOT auto-rebuilt during `npm run android`.

### Helper Functions

```typescript
import { splitTitleAndBody, combineTitleAndBody, extractTitle, extractBody, hasTitleStructure } from '@trace/core';
```

### Key Files

| File | Purpose |
|------|---------|
| `editor-web/index.tsx` | Editor entry point |
| `editor-web/index.html` | HTML template with CSS |
| `editor-web/vite.config.ts` | Vite build config |
| `editor-web/build/editorHtml.js` | Built bundle (auto-generated) |
| `packages/core/src/modules/editor/TitleExtension.ts` | Title node extension |
| `packages/core/src/modules/editor/TitleDocument.ts` | Document schema |
| `src/components/editor/RichTextEditor.tsx` | RN component |
