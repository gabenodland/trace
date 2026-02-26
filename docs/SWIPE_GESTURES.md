# Swipe & Gesture System

Comprehensive reference for all PanResponder-based gesture handling in the Trace mobile app.

---

## Architecture Overview

There are **5 independent PanResponder systems** in the app, each handling a different gesture:

| # | Gesture | File | Applied At | Phase |
|---|---------|------|-----------|-------|
| 1 | **Swipe-back** (sub-screen → main) | `shared/hooks/useSwipeBackGesture.ts` | `App.tsx` root View | Bubble |
| 2 | **Drawer open** (right swipe → stream drawer) | `screens/hooks/useDrawerGestures.ts` | EntryList, Map, Calendar screens | Bubble |
| 3 | **Drawer close** (left swipe on open drawer) | `components/drawer/StreamDrawer.tsx` | Drawer panel Animated.View | Bubble |
| 4 | **Drawer tab swipe** (horizontal tab switching) | `components/drawer/StreamDrawerContent.tsx` | Tab content area | Capture |
| 5 | **Bottom sheet dismiss** (swipe down) | `components/sheets/BottomSheet.tsx` | Sheet container | Bubble |

### Bubble vs Capture Phase

- **Bubble** (`onMoveShouldSetPanResponder`): Children handle touches first. Only unclaimed gestures bubble up to the PanResponder. **Use this for gestures that must yield to child scrollviews.**
- **Capture** (`onMoveShouldSetPanResponderCapture`): PanResponder intercepts before children see the touch. **Use only when the PanResponder must win over children** (e.g., drawer tab swipe must beat child ScrollViews).

**Rule of thumb**: Always use bubble phase unless you have a specific reason to capture. Capture phase races with native FlatList/ScrollView scroll and causes unreliable behavior.

---

## 1. Swipe-Back Gesture (`useSwipeBackGesture`)

**Purpose**: iOS-style swipe-right to navigate from sub-screens (entry editor, settings) back to main screens (entry list, map, calendar).

**File**: `shared/hooks/useSwipeBackGesture.ts`
**Applied at**: `App.tsx:315` — root View wrapping all screen content
**Phase**: Bubble (`onMoveShouldSetPanResponder`)

### Thresholds
- `GESTURE_START_THRESHOLD = 10` — minimum dx before recognizing
- `SWIPE_THRESHOLD = SCREEN_WIDTH / 5` (~78px) — dx to trigger back navigation
- `VELOCITY_THRESHOLD = 0.5` — velocity to trigger back (even if below distance threshold)
- Ratio: `Math.abs(dx) > Math.abs(dy) * 1.5` — must be clearly horizontal

### Guard Checks (in order)
1. `!isEnabledRef.current` — disabled on main views
2. `getIsModalOpen()` — blocked when sheet/modal is open
3. `isTableTouched` — async flag set by editor WebView when touching a table
4. `isInTableCooldown()` — 200ms cooldown after `tableTouchEnd` (prevents accidental swipe-back after table scroll)

### Push Animation
- `startPushAnimation()` — called from press handlers BEFORE `navigate()` to give the slide animation a head start while React does heavy layout work
- `isPushAnimating()` — prevents double-firing animations when both press handler and `isEnabled` change trigger animation

### Module-Level State
```
isTableTouched          — set by EditorWebBridge via setTableTouched()
_lastTableTouchEndTime  — timestamp for cooldown calculation
_mainViewTranslateX     — shared ref for startPushAnimation()
_pushAnimationRunning   — prevents concurrent push animations
```

### Key Design Decisions
- PanResponder callbacks captured at creation time → use refs (`isEnabledRef`, `onBackRef`, `checkBeforeBackRef`) to access current values
- `translateX` set synchronously during render for `false→true` transition (entering sub-screen) to prevent flash
- `Keyboard.dismiss()` + `DeviceEventEmitter.emit('blurEditors')` on gesture start

---

## 2. Drawer Open Gesture (`useDrawerGestures`)

**Purpose**: Swipe right from any main screen to open the stream drawer.

**File**: `screens/hooks/useDrawerGestures.ts`
**Applied at**: EntryListScreen, MapScreen, CalendarScreen — each screen's root View
**Phase**: Bubble (`onMoveShouldSetPanResponder`)

### Thresholds
- `GESTURE_START_THRESHOLD = 12` — slightly higher than swipe-back
- `EDGE_ZONE = 40` — ignores touches in the leftmost 40px (Android back gesture zone)
- Ratio: `Math.abs(dx) > Math.abs(dy) * 1.5`

### Guard Checks
1. `getIsModalOpen()` — blocked when sheet/modal is open
2. `getIsTableTouched()` — blocked when user is touching an editor table
3. `getIsNativeTableTouched()` — blocked when user is touching an RNRH-rendered table in the entry list

### DrawerControl Interface
The hook communicates with `StreamDrawer` via a `DrawerControl` ref:
- `setPosition(dx)` — tracks finger position during drag
- `animateOpen(velocity)` — spring to open with gesture velocity
- `animateClose()` — spring to closed
- `getDrawerWidth()` — returns drawer width for threshold calculation

### Shared Across All Main Screens
Previously each screen had its own inline PanResponder (MapScreen, CalendarScreen had ~40 lines each). Now unified into this single hook.

---

## 3. Drawer Close Gesture (StreamDrawer)

**Purpose**: Swipe left on the open drawer panel to close it.

**File**: `components/drawer/StreamDrawer.tsx`
**Applied at**: The drawer panel's Animated.View
**Phase**: Bubble

### Thresholds
- `dx < -10` to start recognizing (left swipe)
- `dx < -80 || vx < -0.5` to trigger close

### Critical: `pointerEvents` and `stopAnimation`
- `pointerEvents={isOpen ? "auto" : "none"}` — during close animation, touches pass through to content underneath so the user can immediately re-swipe to open
- `setPosition()` calls `translateX.stopAnimation()` — prevents running close spring from fighting with new gesture's `setValue`
- `animationIdRef` counter — prevents `useEffect` from double-firing animations when `animateClose`/`animateOpen` already started them

**Lesson learned**: Previously used `isVisible` state for `pointerEvents`, which kept `pointerEvents="auto"` during close animation (~800ms). This blocked ALL touches, causing a "can't re-swipe for 1 second" bug. Fix: use `isOpen` only.

---

## 4. Drawer Tab Swipe (StreamDrawerContent)

**Purpose**: Horizontal swipe between tabs (Streams, Places, Tags, Mentions) inside the drawer.

**File**: `components/drawer/StreamDrawerContent.tsx`
**Phase**: **Capture** (`onMoveShouldSetPanResponderCapture`)

### Why Capture Phase
The tab content area contains ScrollViews (stream list, tag list). Without capture, these ScrollViews would claim horizontal swipes. The tab swipe MUST win over child scrolls.

### Critical: `onPanResponderTerminationRequest: () => false`
Child ScrollViews' `onMoveShouldSetPanResponder` fires on subsequent move events and tries to steal the gesture. Returning `false` from `onPanResponderTerminationRequest` prevents this.

### Velocity Multiplier
`gs.dx * 1.5` — amplifies the finger movement for snappier tab switching feel.

---

## 5. Bottom Sheet Dismiss (BottomSheet)

**Purpose**: Swipe down to dismiss a bottom sheet.

**File**: `components/sheets/BottomSheet.tsx`
**Phase**: Bubble

### Thresholds
- `dy > 10` to start recognizing
- `dy > 100 || vy > 0.5` to trigger dismiss

### `swipeArea` Prop
- `"full"` — panHandlers on entire sheet container
- `"grabber"` — panHandlers only on the grabber bar (avoids scroll conflicts)

---

## Table Touch Protection

Tables need special handling because they have horizontal ScrollViews that conflict with swipe gestures.

### Two Table Types

| Type | Rendered By | Touch Detection | Where Used |
|------|------------|----------------|------------|
| **RNRH Tables** | `htmlRenderers.tsx` TableRenderer | Synchronous `onTouchStart` on wrapper View | Entry list (flow/short modes) |
| **Editor Tables** | WebView DOM | Async `postMessage` from WebView JS | Entry editor screen |

### RNRH Tables (Synchronous) — Entry List

RNRH tables are rendered as native React Native Views with a horizontal `ScrollView`. They live inside an `EntryListItem` which is wrapped in a `TouchableOpacity` (for tap-to-navigate).

#### View Hierarchy
```
HtmlRenderProvider (per-screen, wraps list)
  └── FlatList
        └── TouchableOpacity (entry item — onPress navigates to entry)
              └── EntryListItemDefault
                    └── WebViewHtmlRenderer → RenderHTMLSource (consumes provider via context)
                          └── TableRenderer output:
                                └── View (tableWrapper) ← touch flag handlers
                                      └── ScrollView (horizontal) ← table scroll
                                            └── View (table content) ← responder claim + tap detection
                                                  └── rows/cells
```

#### Problem 1: Horizontal Scroll Doesn't Work

Without special handling, the parent `TouchableOpacity` claims the touch on `ACTION_DOWN`. When `TouchableOpacity` owns the touch, the horizontal `ScrollView` inside the table never sees `ACTION_MOVE` events — its `onInterceptTouchEvent` never fires. Result: the table can only scroll with a quick flick (where the OS gives ScrollView a chance), not a deliberate hold-then-drag.

**Fix**: The inner table content View (INSIDE the ScrollView) claims the JS responder:
```tsx
<View onStartShouldSetResponder={() => true}>
```

This does two things:
1. **JS level**: The inner View wins the responder over the parent `TouchableOpacity` (deepest view wins in bubble phase)
2. **Native level**: Sets `mFirstTouchTarget` in Android's dispatch chain at every level (`TouchableOpacity` → `tableWrapper` → `ScrollView` → `innerView`). When `ACTION_MOVE` fires, `ScrollView.onInterceptTouchEvent` fires and can detect horizontal scroll.

**Critical**: The `onStartShouldSetResponder` MUST be on the View INSIDE the ScrollView, not on the wrapper outside. If placed on the wrapper, `mFirstTouchTarget` is set on the wrapper but NOT on the ScrollView's children — the ScrollView never sees move events.

#### Problem 2: Swipe Gestures Steal Table Scroll

The drawer-open gesture (`useDrawerGestures`) and swipe-back gesture (`useSwipeBackGesture`) both detect horizontal right swipes. When the user scrolls a table right, these gestures could claim the touch instead.

**Fix**: Synchronous touch flag on the table wrapper View:
```tsx
<View
  style={styles.tableWrapper}
  onTouchStart={() => { _isNativeTableTouched = true; }}
  onTouchEnd={() => { _isNativeTableTouched = false; }}
  onTouchCancel={() => { _isNativeTableTouched = false; }}
>
```

**Flag**: `_isNativeTableTouched` in `htmlRenderers.tsx`
**Getter**: `getIsNativeTableTouched()`
**Checked by**: `useDrawerGestures` — returns false from `onMoveShouldSetPanResponder` when flag is set

This is synchronous (native `onTouchStart` fires in the same frame as the touch), so it's always set before any PanResponder callback runs.

#### Problem 3: Tapping a Table Does Nothing

Because the inner View claims `onStartShouldSetResponder`, it steals the tap from the parent `TouchableOpacity`. Tapping on a table doesn't navigate to the entry.

**Fix**: Tap detection on the inner View via the JS responder callbacks:
```tsx
<View
  onStartShouldSetResponder={() => true}
  onResponderGrant={(e) => {
    touchStartRef.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  }}
  onResponderRelease={(e) => {
    const dx = Math.abs(e.nativeEvent.pageX - touchStartRef.current.x);
    const dy = Math.abs(e.nativeEvent.pageY - touchStartRef.current.y);
    if (dx < 10 && dy < 10 && onEntryPress) {
      onEntryPress();
    }
  }}
>
```

When the user taps (small displacement), `onResponderRelease` fires and forwards the tap to the entry's `onPress` via `HtmlContentPressContext`. When the user scrolls, the `ScrollView` intercepts the touch natively → `onResponderTerminate` fires instead of `onResponderRelease` → no tap detected.

**Context**: `HtmlContentPressContext` is provided by `EntryListItem` (which has the `onPress` prop) and consumed by `TableRenderer`.

### Editor Tables (Async + Cooldown)

**Flag**: `isTableTouched` in `useSwipeBackGesture.ts`
**Setter**: `setTableTouched()` called by `EditorWebBridge.tsx`
**Checked by**: `useSwipeBackGesture` (swipe-back gesture)

The WebView JS (`editor-web/index.html`) sends messages:
- `tableTouchStart` — when `touchstart` target is inside a table
- `tableTouchEnd` — when `touchend`/`touchcancel` fires after a table touch

**The async bridge problem**: `postMessage` from WebView → React Native has ~16ms latency. For fast swipes, `onMoveShouldSetPanResponder` fires before `tableTouchStart` arrives. This means very fast first-swipe on a table can still trigger swipe-back.

**Cooldown mitigation**: When `tableTouchEnd` fires, we record `Date.now()`. For 200ms after, `isInTableCooldown()` returns true and blocks swipe-back. This prevents the common pattern of: scroll table right → lift finger → immediately re-touch and swipe → accidental navigation.

```
TABLE_TOUCH_COOLDOWN_MS = 200
```

**Why not synchronous detection for editor tables**: The WebView's DOM is opaque to React Native. We cannot add `onTouchStart` handlers on DOM elements inside the WebView. The `postMessage` bridge is the only communication channel. Attempts to use synchronous flags on the WebView container View (blocking swipe-back for ALL editor touches until the async message classified it) caused unacceptable lag on swipe-back for non-table areas.

---

## Android Touch Dispatch Internals

Understanding these is critical for debugging gesture issues:

### `mFirstTouchTarget` Chain
When a native View's `onTouchEvent(ACTION_DOWN)` returns true, Android sets it as the touch target (`mFirstTouchTarget`). Children only receive subsequent `ACTION_MOVE` if `mFirstTouchTarget` was set at their level. **If a parent View claims `ACTION_DOWN` but no CHILD consumed it, `mFirstTouchTarget` is null and children never see `ACTION_MOVE`.**

This is why `onStartShouldSetResponder={() => true}` must be on the table content View INSIDE the ScrollView (not on the wrapper outside). It ensures `mFirstTouchTarget` is set at every level so `ScrollView.onInterceptTouchEvent` fires on `ACTION_MOVE`.

### JS Responder vs Native Scroll
React Native dispatches touch events to BOTH the JS responder system and native View hierarchy in parallel. A JS responder claim causes the native View to return true from `onTouchEvent(ACTION_DOWN)`, affecting Android's native dispatch chain.

### Responder Negotiation
When a parent PanResponder wants to claim (via `onMoveShouldSetPanResponder: true`), it triggers `onResponderTerminationRequest` on the current JS responder. If that returns `false`, the PanResponder's claim fails. **However**, `onMoveShouldSetPanResponder` fires again on the NEXT move event — the PanResponder retries.

**Warning**: `onStartShouldSetResponder` on a WebView container View can interfere with native WebView touch handling. In testing, claiming the JS responder on the container and refusing termination blocked ALL swipe-back, not just table touches. The PanResponder retry mechanism didn't work reliably in this configuration.

---

## Lessons Learned

### What Works
- **Bubble phase for parent gestures**: Always use `onMoveShouldSetPanResponder` (bubble) for gestures on parent Views that need to yield to child ScrollViews
- **Capture phase for must-win gestures**: Use `onMoveShouldSetPanResponderCapture` only when the PanResponder must beat children (drawer tab swipe)
- **Module-level boolean flags**: Simple, synchronous, zero-overhead way to communicate between gesture handlers (`_isNativeTableTouched`, `isTableTouched`)
- **`onPanResponderTerminationRequest: () => false`**: Essential when child and parent both handle horizontal swipes — prevents parent from stealing gesture on subsequent moves
- **`translateX.stopAnimation()` in `setPosition`**: Prevents running spring from fighting with new gesture's `setValue`
- **Cooldown after async events**: 200ms cooldown after `tableTouchEnd` bridges the async gap without blocking non-table interactions

### What Doesn't Work
- **`onStartShouldSetResponder` on WebView container**: Blocks the parent PanResponder's retry mechanism. Even though `onMoveShouldSetPanResponder` fires on every move, the responder negotiation doesn't reliably retry after denial
- **Circular imports for gesture flags**: `EditorWebBridge` ↔ `useSwipeBackGesture` circular import caused `getIsEditorTableTouched` to be `undefined` at runtime, silently crashing `onMoveShouldSetPanResponder`. Always keep gesture state in one module with one-way imports
- **Async-only protection for fast swipes**: WebView `postMessage` has ~16ms latency. `onMoveShouldSetPanResponder` can fire before the message arrives. Can't be solved with synchronous flags on the WebView container because it blocks too aggressively
- **`isVisible` state for `pointerEvents`**: During close animation, `isVisible` stays true → full-screen overlay blocks all touches for ~800ms

### Editor Bundle
The `editor-web/index.html` is compiled into `editor-web/build/editorHtml.js` via:
```
npm run editor:build    # in apps/mobile/
```
**Any changes to `editor-web/index.html` require rebuilding this bundle.** The WebView loads the bundled version, not the source HTML. Forgetting to rebuild means your WebView JS changes silently don't take effect.

---

## File Reference

| File | Role |
|------|------|
| `shared/hooks/useSwipeBackGesture.ts` | Swipe-back hook + table touch state + cooldown |
| `screens/hooks/useDrawerGestures.ts` | Drawer open gesture (shared by 3 screens) |
| `components/drawer/StreamDrawer.tsx` | Drawer close gesture + animation control |
| `components/drawer/StreamDrawerContent.tsx` | Tab swipe gesture inside drawer |
| `components/sheets/BottomSheet.tsx` | Bottom sheet dismiss gesture |
| `components/editor/EditorWebBridge.tsx` | WebView table touch message handling |
| `modules/entries/helpers/htmlRenderers.tsx` | RNRH table touch flags + tap forwarding |
| `editor-web/index.html` | WebView JS for table touch detection |
| `shared/constants/animations.ts` | `IOS_SPRING` config for gesture animations |
