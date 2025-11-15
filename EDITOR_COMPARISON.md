# React Native Rich Text Editor Comparison for Inline Photos

## The Core Problem

**Android 11+ (API 30+) blocks `file://` URIs in WebView with `ERR_ACCESS_DENIED`** - regardless of which editor library you use.

This is a fundamental Android security restriction, not a library limitation.

---

## Editor Options Analyzed

### 1. @10play/tentap-editor (CURRENT)

**Type**: WebView-based (TipTap/ProseMirror)

**Image Support**: ✅ Yes - `ImageBridge` with `setImage()` method

**Local File Support**: ❌ Blocked by Android 11+ WebView security

**What TenTap Docs Say**:
> "Store [editor HTML] in the same place with our photos... add allowFileAccess, allowFileAccessFromFileURLs, allowUniversalAccessFromFileURLs..."

**Reality**: We implemented this exactly - still blocked on Android 11+.

**Why Their Example Works**: TenTap's sticker example uses `https://cloudfront.net/...` URLs, not local `file://` paths.

**Pros**:
- ✅ Mature, well-maintained library
- ✅ Full TipTap feature set (lists, formatting, undo/redo)
- ✅ Image API built-in
- ✅ Works great with remote HTTPS images

**Cons**:
- ❌ Local file:// images blocked on Android 11+
- ⚠️ Would need base64 workaround for local images

---

### 2. expo-rte

**Type**: Native (no WebView) - built with expo-modules, Kotlin, Swift

**Image Support**: ❌ No image support

**Features**:
- Bold, italic, underline, strikethrough
- Bullet lists, numbered lists
- Undo/redo
- Native performance

**Pros**:
- ✅ No WebView = no file:// restrictions
- ✅ Fast native performance
- ✅ Better UX (native text selection, keyboard)

**Cons**:
- ❌ **No image support at all**
- ❌ Missing many rich text features
- ❌ Less mature ecosystem

**Verdict**: Doesn't solve our problem - we need inline photos.

---

### 3. react-native-pell-rich-editor

**Type**: WebView-based (Pell.js)

**Image Support**: ✅ Yes - `insertImage()` method

**Local File Support**: ❌ Requires base64 conversion

**Official Solution** (from Stack Overflow):
```javascript
import ImgToBase64 from 'react-native-image-base64';

ImgToBase64.getBase64String(image.path).then((base64String) => {
  const dataUri = `data:${image.mime};base64,${base64String}`;
  this.richText.current?.insertImage(dataUri);
});
```

**Pros**:
- ✅ Lighter weight than TenTap
- ✅ Image support exists

**Cons**:
- ❌ **Same WebView file:// restriction as TenTap**
- ❌ Requires base64 conversion (memory intensive)
- ⚠️ Less feature-rich than TenTap

**Verdict**: Switching to Pell doesn't help - same Android WebView issue.

---

### 4. react-native-rich-editor

**Type**: WebView-based (Quill.js)

**Image Support**: ✅ Yes

**Local File Support**: ❌ Same WebView restrictions

**Verdict**: Same problem as TenTap and Pell.

---

### 5. react-native-cn-quill

**Type**: WebView-based (Quill.js)

**Image Support**: ✅ Yes

**Local File Support**: ❌ Same WebView restrictions

**Verdict**: Same problem as all WebView editors.

---

### 6. react-native-aztec (Native)

**Type**: Native editor (used by WordPress)

**Image Support**: ✅ Yes - can insert native images

**Local File Support**: ✅ Should work (no WebView)

**Pros**:
- ✅ Native performance
- ✅ No WebView restrictions
- ✅ Proven in production (WordPress app)

**Cons**:
- ❌ **CRITICAL**: iOS-only library
- ❌ Would need different editor for Android
- ❌ Complex integration
- ❌ WordPress-specific architecture

**Verdict**: Not cross-platform.

---

### 7. react-native-live-markdown

**Type**: Native markdown editor

**Image Support**: ⚠️ Markdown syntax only

**Local File Support**: ✅ Should work (no WebView)

**Format**: `![alt](file:///path/to/image.jpg)`

**Pros**:
- ✅ Native performance
- ✅ No WebView = no file:// issues
- ✅ Cross-platform (iOS/Android)

**Cons**:
- ❌ Markdown syntax (not WYSIWYG)
- ❌ Users see `![Image](...)` not rendered images while editing
- ⚠️ Different UX paradigm

**Verdict**: Could work, but not a WYSIWYG editor - users type markdown.

---

## The Fundamental Issue

**All WebView-based editors** (TenTap, Pell, Quill) have the same problem:
- Android 11+ blocks `file://` URIs
- `allowFileAccess` is JavaScript-level, doesn't override native Android WebView settings
- Same-origin policies don't help

**Native editors** either:
- Don't support images (expo-rte)
- Platform-specific (react-native-aztec - iOS only)
- Non-WYSIWYG markdown (react-native-live-markdown)

---

## Solution Comparison

| Approach | Works? | Effort | Tradeoff |
|----------|--------|--------|----------|
| **Current: Placeholder in editor** | ✅ Yes | Zero (done) | No inline preview |
| **Switch to expo-rte** | ❌ No | High | No image support at all |
| **Switch to Pell/Quill** | ❌ No | Medium | Same WebView issue |
| **Base64 with TenTap** | ✅ Yes | Medium | Memory/performance |
| **Content URIs** | ⚠️ Maybe | High | Requires EAS Build/eject |
| **Local HTTP server** | ✅ Yes | High | Battery/security concerns |
| **Upload to Supabase first** | ✅ Yes | Medium | Requires internet |

---

## Recommendation

**Stay with TenTap + current placeholder approach.**

### Why:

1. **TenTap is the best rich text editor** for React Native
   - Most mature WebView-based editor
   - Full feature set (lists, formatting, undo/redo, tables, etc.)
   - Active maintenance
   - Best documentation

2. **Switching editors doesn't solve the problem**
   - expo-rte: No images
   - Pell/Quill: Same WebView issue
   - Aztec: iOS-only
   - Markdown: Not WYSIWYG

3. **Current solution works reliably**
   - Photos work end-to-end
   - Flow view displays images beautifully
   - No security/permission issues
   - Users can see preview when saving entry

4. **Better to invest in TenTap workarounds if needed**
   - Base64 encoding (Option B) if inline preview becomes critical
   - Upload to Supabase immediately (Option E) for online editing
   - Content URIs (Option C) when building with EAS

---

## If You Still Want Inline Display

### Option 1: Base64 with TenTap (Recommended)

Keep TenTap, convert photos to base64 data URIs:

```typescript
// In CaptureForm.tsx
const file = new File(localPath);
const arrayBuffer = await file.read();
const uint8Array = new Uint8Array(arrayBuffer);
const base64 = btoa(String.fromCharCode(...uint8Array));
const dataUri = `data:image/jpeg;base64,${base64}`;

editorRef.current?.setImage(dataUri);
```

**Tradeoff**:
- ✅ Works in WebView
- ✅ Images display inline
- ❌ ~1-2MB per image in memory
- ❌ Slower editor performance with multiple images

### Option 2: Upload First, Then Insert (Easiest)

Upload to Supabase immediately, use signed HTTPS URL:

```typescript
const uploadResult = await uploadPhotoToSupabase(localPath, remotePath);
const signedUrl = await getSignedPhotoUrl(photoId);

editorRef.current?.setImage(signedUrl); // https:// works fine
```

**Tradeoff**:
- ✅ Works in WebView (HTTPS allowed)
- ✅ No memory issues
- ❌ Requires internet connection
- ❌ Slightly slower (upload time)

---

## The Truth About TenTap Documentation

**TenTap docs say their approach should work** - and it *did* work on Android 10 and earlier.

**Android 11+ changed the rules** (API 30+, released September 2020):
- `WebSettings.setAllowFileAccess()` defaults to `false`
- Even with `allowFileAccess={true}` prop, native WebView still blocks

**TenTap's sticker example uses HTTPS** (`https://cloudflare.net/...`), not local files.

**Expo Go cannot configure native WebView settings** - would need EAS Build or bare React Native.

---

## Final Answer

**Is there a better editor?**

**No.** TenTap is the best option. The problem isn't the editor - it's Android 11+ WebView security that affects ALL WebView-based editors equally.

**Should you switch editors?**

**No.** Switching would:
- Lose features (expo-rte has no images)
- Have the same problem (Pell/Quill blocked by WebView)
- Require platform-specific code (Aztec iOS-only)
- Change UX paradigm (markdown editors)

**Best path forward:**

1. **Ship with current placeholder approach** - works 100% reliably
2. **Monitor user feedback** - do users care about inline preview?
3. **If needed**, implement base64 or upload-first approach with TenTap
4. **Consider Content URIs** when building with EAS (longer term)

The current solution is solid, production-ready, and avoids the WebView security rabbit hole.
