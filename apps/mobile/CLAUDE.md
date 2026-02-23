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

---

## 📍 Places (Location System)

### Terminology

User-facing text uses **"Place"** — never "location". The word "location" is reserved for code-level identifiers (table names, variables, types).

| Tier | User Label | Condition | DB State |
|------|-----------|-----------|----------|
| **Unnamed Place** | "Unnamed Place" | GPS/geo coordinates only, no name | `place_name` is null, no `location_id` |
| **Place** | (shows place name) | Has GPS, geo, and a name | `place_name` set, no `location_id` |
| **My Place** | (shows place name) | Saved to `locations` table | Has `location_id`, `is_favorite = true` |

Old terms → new terms:
- ~~"Dropped Pin"~~ → **"Unnamed Place"**
- ~~"Location"~~ (user-facing) → **"Place"**
- ~~"Saved Location"~~ → **"My Place"** / **"My Places"**
- ~~"Save Location"~~ → **"Save to My Places"**

### Icons

All place icons live in `src/shared/components/Icon.tsx` as custom SVGs.

**Map markers (solid filled):**

| Icon Name | Appearance | Used For |
|-----------|------------|----------|
| `MapPinFilled` | Solid teardrop, no inner shape | Unnamed Place marker |
| `MapPinSolid` | Solid teardrop + white circle | Place marker (named, not saved) |
| `MapPinFavorite` | Solid teardrop + white star cutout | My Place marker |

**List/UI icons (outline):**

| Icon Name | Appearance | Used For |
|-----------|------------|----------|
| `MapPinEmpty` | Outline teardrop only | Unnamed Place in lists |
| `MapPin` | Lucide library `map-pin` | Place in lists (named, not saved) |
| `MapPinFavoriteLine` | Outline teardrop + filled star | My Place in lists |

**Rule:** Solid variants on maps, outline variants in lists/drawers/pickers. Always use the `<Icon>` component — never hardcode SVG paths inline.

### Module Structure

```
modules/locations/
├── mobileLocationApi.ts       # SQLite DB ops (internal)
├── mobileLocationHooks.ts     # React Query hooks (useLocations, usePlaces)
├── components/
│   └── LocationPicker/        # Place picker modal
│       ├── LocationPicker.tsx          # Orchestrator
│       ├── hooks/useLocationPicker.ts  # Picker state
│       └── components/
│           ├── CurrentLocationView.tsx  # View/edit current place
│           ├── LocationSelectView.tsx   # Search/select saved places
│           └── CreateLocationView.tsx   # Create new place
├── styles/
└── types/
```

### Key Screens

| Screen | File | Purpose |
|--------|------|---------|
| Places Management | `src/screens/LocationsScreen.tsx` | CRUD for My Places |
| Edit Place | (inline in LocationPicker via `useLocationPicker.isEditingPlace`) | Inline edit in CurrentLocationView |
| Map | `src/screens/MapScreen.tsx` | Map with three-tier markers |
| Drawer (Places tab) | `src/components/drawer/StreamDrawerContent.tsx` | Entry-derived place list |
