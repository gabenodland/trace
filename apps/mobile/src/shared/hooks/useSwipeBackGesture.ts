/**
 * useSwipeBackGesture
 *
 * iOS-style swipe-back gesture hook for navigating from sub-screens back to main views.
 * When user swipes right from anywhere on a sub-screen, the main view slides in from the left.
 *
 * Key design decisions (matching StreamDrawer pattern for smooth gestures):
 * - Do NOTHING in onPanResponderGrant (no state updates that could cause lag)
 * - Track finger position directly in onPanResponderMove
 * - Only animate/navigate on release
 *
 * Usage:
 * ```tsx
 * const { panHandlers, mainViewTranslateX } = useSwipeBackGesture({
 *   isEnabled: !isOnMainView,
 *   onBack: () => navigate(targetMainView),
 *   checkBeforeBack,
 * });
 *
 * <View {...panHandlers}>
 *   <Animated.View style={{ transform: [{ translateX: mainViewTranslateX }] }}>
 *     {mainViewContent}
 *   </Animated.View>
 * </View>
 * ```
 */

import { useRef } from "react";
import { Animated, Easing, PanResponder, Dimensions, GestureResponderHandlers, Keyboard, DeviceEventEmitter } from "react-native";
import { createScopedLogger, LogScopes } from "../utils/logger";

const log = createScopedLogger(LogScopes.Navigation);

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH / 3; // Same as drawer
const VELOCITY_THRESHOLD = 0.5; // Same as drawer
const GESTURE_START_THRESHOLD = 10; // When to recognize gesture
const SWIPE_MULTIPLIER = 2; // 2x multiplier - makes swipe feel more responsive
const PUSH_ANIMATION_DURATION = 200; // Duration of forward push animation
// iOS UINavigationController push curve: fast start, gentle deceleration
const PUSH_EASING = Easing.bezier(0.25, 0.1, 0.25, 1.0);

// Module-level ref: allows press handlers to start push animation before navigate()
// This gives the animation a head start before React's heavy render/layout work begins.
let _mainViewTranslateX: Animated.Value | null = null;
let _pushAnimationRunning = false;

/** Whether a push animation is currently in flight */
export function isPushAnimating(): boolean {
  return _pushAnimationRunning;
}

/**
 * Start the push animation immediately (call from press handler BEFORE navigate).
 * The animation runs on the native thread while JS is free.
 * @param onComplete - Called after animation finishes. Use to trigger navigate()
 *   so React's heavy layout work never competes with the animation.
 */
export function startPushAnimation(onComplete?: () => void) {
  if (_mainViewTranslateX && !_pushAnimationRunning) {
    _pushAnimationRunning = true;
    log.debug('[SwipeBack] startPushAnimation: starting from press handler');
    // Safety timeout: reset flag if animation callback never fires (e.g., unmount)
    const safetyTimer = setTimeout(() => {
      if (_pushAnimationRunning) {
        log.warn('[SwipeBack] Safety timeout: resetting _pushAnimationRunning');
        _pushAnimationRunning = false;
      }
    }, PUSH_ANIMATION_DURATION + 500);
    Animated.timing(_mainViewTranslateX, {
      toValue: -SCREEN_WIDTH,
      duration: PUSH_ANIMATION_DURATION,
      easing: PUSH_EASING,
      useNativeDriver: true,
    }).start(() => {
      clearTimeout(safetyTimer);
      _pushAnimationRunning = false;
      onComplete?.();
    });
  }
}

interface UseSwipeBackGestureOptions {
  /** Whether swipe-back is enabled (typically false when on main view) */
  isEnabled: boolean;
  /** Callback to trigger navigation back */
  onBack: () => void;
  /** Optional async check before back (e.g., autosave). Returns true to proceed, false to cancel. */
  checkBeforeBack?: () => Promise<boolean>;
  /** Whether a fullscreen modal is open (disables gesture entirely) */
  isModalOpen?: boolean;
}

interface UseSwipeBackGestureResult {
  /** Spread these on the container View */
  panHandlers: GestureResponderHandlers;
  /** Animated value for main view translateX. Goes from -SCREEN_WIDTH to 0. */
  mainViewTranslateX: Animated.Value;
  /** Screen width constant for positioning */
  screenWidth: number;
}

export function useSwipeBackGesture({
  isEnabled,
  onBack,
  checkBeforeBack,
  isModalOpen = false,
}: UseSwipeBackGestureOptions): UseSwipeBackGestureResult {
  // Animation value: -SCREEN_WIDTH (off-screen) to 0 (visible)
  // CRITICAL: Initialize with correct value based on isEnabled to prevent flash
  const initialTranslateX = isEnabled ? -SCREEN_WIDTH : 0;
  const mainViewTranslateX = useRef(new Animated.Value(initialTranslateX)).current;

  // Expose to module-level so startPushAnimation() can access it
  _mainViewTranslateX = mainViewTranslateX;

  // Refs for pan responder (avoid stale closures)
  const isEnabledRef = useRef(isEnabled);
  isEnabledRef.current = isEnabled;

  // Track callbacks via refs to avoid stale closures in PanResponder
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const checkBeforeBackRef = useRef(checkBeforeBack);
  checkBeforeBackRef.current = checkBeforeBack;

  // Track previous isEnabled to detect changes
  const prevIsEnabledRef = useRef(isEnabled);

  // CRITICAL: Set translateX synchronously during render when entering sub-screen
  // This ensures the value is set BEFORE the Animated.View evaluates its transform
  // We only do this for the false->true transition (entering sub-screen)
  // The true->false transition is handled by the swipe animation completing to 0
  if (prevIsEnabledRef.current !== isEnabled) {
    log.debug('[SwipeBack] isEnabled changed:', {
      from: prevIsEnabledRef.current,
      to: isEnabled,
    });

    if (isEnabled) {
      if (_pushAnimationRunning) {
        // Animation already started from press handler — let it continue
        log.debug('[SwipeBack] Push animation already running from press handler, skipping');
      } else {
        // Fallback: start animation now (e.g., navigate called without startPushAnimation)
        log.debug('[SwipeBack] Starting push animation (fallback)');
        Animated.timing(mainViewTranslateX, {
          toValue: -SCREEN_WIDTH,
          duration: PUSH_ANIMATION_DURATION,
          easing: PUSH_EASING,
          useNativeDriver: true,
        }).start();
      }
    } else {
      // Returning to main view: set translateX to 0 so Animated.View always uses
      // the same Animated.Value source. Without this, App.tsx had to use a
      // `isOnMainView ? 0 : mainViewTranslateX` ternary which switches between
      // static and animated values, causing Android to re-layout the subtree
      // and corrupt FlatList/SectionList scroll offsets.
      log.debug('[SwipeBack] Setting translateX to 0 (sync)');
      mainViewTranslateX.setValue(0);
    }

    prevIsEnabledRef.current = isEnabled;
  }

  const panResponder = useRef(
    PanResponder.create({
      // Don't capture initial touch - let children handle taps
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Don't capture when disabled
        if (!isEnabledRef.current) {
          log.debug('[SwipeBack] onMoveShouldSet: BLOCKED (disabled)');
          return false;
        }
        // Require clear horizontal swipe to the right
        const shouldCapture = gs.dx > GESTURE_START_THRESHOLD && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
        if (shouldCapture) {
          log.debug('[SwipeBack] onMoveShouldSet: CAPTURING swipe');
          // Dismiss keyboard and blur all editors immediately
          Keyboard.dismiss();
          DeviceEventEmitter.emit('blurEditors');
        }
        return shouldCapture;
      },
      onPanResponderGrant: () => {
        log.debug('[SwipeBack] onPanResponderGrant: gesture started');
      },
      onPanResponderMove: (_, gs) => {
        // Match drawer pattern: Just track the finger position directly
        // Multiplier makes it feel more responsive (less physical distance needed)
        const newX = Math.max(-SCREEN_WIDTH, Math.min(0, -SCREEN_WIDTH + gs.dx * SWIPE_MULTIPLIER));
        mainViewTranslateX.setValue(newX);
      },
      onPanResponderRelease: async (_, gs) => {
        log.debug('[SwipeBack] onPanResponderRelease:', { dx: gs.dx, vx: gs.vx, threshold: SWIPE_THRESHOLD });

        if (gs.dx > SWIPE_THRESHOLD || gs.vx > VELOCITY_THRESHOLD) {
          // Past threshold - check if we can go back (use ref to get latest callback)
          const canGoBack = checkBeforeBackRef.current ? await checkBeforeBackRef.current() : true;
          log.debug('[SwipeBack] Past threshold', { canGoBack });

          if (canGoBack) {
            // Complete slide-in animation then navigate
            log.debug('[SwipeBack] Animating to 0 then navigating back');
            Animated.timing(mainViewTranslateX, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }).start(() => {
              log.debug('[SwipeBack] Animation complete, calling onBack');
              onBackRef.current();  // Use ref to get latest callback
            });
          } else {
            // User cancelled (e.g., discard dialog) - snap back
            log.debug('[SwipeBack] Cancelled, snapping back');
            Animated.timing(mainViewTranslateX, {
              toValue: -SCREEN_WIDTH,
              duration: 150,
              useNativeDriver: true,
            }).start();
          }
        } else {
          // Not past threshold - snap back
          log.debug('[SwipeBack] Not past threshold, snapping back');
          Animated.timing(mainViewTranslateX, {
            toValue: -SCREEN_WIDTH,
            duration: 150,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // Gesture interrupted - snap back to current state
        Animated.timing(mainViewTranslateX, {
          toValue: isEnabledRef.current ? -SCREEN_WIDTH : 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return {
    panHandlers: panResponder.panHandlers,
    mainViewTranslateX,
    screenWidth: SCREEN_WIDTH,
  };
}
