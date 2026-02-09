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

import { useRef, useLayoutEffect } from "react";
import { Animated, PanResponder, Dimensions, GestureResponderHandlers, Keyboard, DeviceEventEmitter } from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH / 3; // Same as drawer
const VELOCITY_THRESHOLD = 0.5; // Same as drawer
const GESTURE_START_THRESHOLD = 10; // When to recognize gesture
const SWIPE_MULTIPLIER = 2; // 2x multiplier - makes swipe feel more responsive

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

  // Refs for pan responder (avoid stale closures)
  const isEnabledRef = useRef(isEnabled);
  isEnabledRef.current = isEnabled;

  // Track modal state via ref for pan responder
  const isModalOpenRef = useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;

  // Track callbacks via refs to avoid stale closures in PanResponder
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const checkBeforeBackRef = useRef(checkBeforeBack);
  checkBeforeBackRef.current = checkBeforeBack;

  // Track previous isEnabled to detect changes
  const prevIsEnabledRef = useRef(isEnabled);

  // Reset animation when enabled state changes
  // IMPORTANT: useLayoutEffect runs synchronously before paint
  useLayoutEffect(() => {
    const prevIsEnabled = prevIsEnabledRef.current;
    prevIsEnabledRef.current = isEnabled;

    // Skip if this is the initial render (value already set correctly in useRef)
    if (prevIsEnabled === isEnabled) {
      return;
    }

    if (isEnabled) {
      // Sub-screen: main view off-screen to left
      mainViewTranslateX.setValue(-SCREEN_WIDTH);
    } else {
      // Main view: visible
      mainViewTranslateX.setValue(0);
    }
  }, [isEnabled]);

  const panResponder = useRef(
    PanResponder.create({
      // Don't capture initial touch - let children handle taps
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Don't capture when disabled or modal is open
        if (!isEnabledRef.current || isModalOpenRef.current) {
          return false;
        }
        // Require clear horizontal swipe to the right
        const shouldCapture = gs.dx > GESTURE_START_THRESHOLD && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
        if (shouldCapture) {
          // Dismiss keyboard immediately when swipe gesture is detected
          // Emit event for WebView editors to blur (Keyboard.dismiss alone doesn't work for WebViews)
          DeviceEventEmitter.emit('blurEditors');
          Keyboard.dismiss();
        }
        return shouldCapture;
      },
      onPanResponderGrant: () => {
        // Gesture granted - no logging needed (too noisy)
      },
      onPanResponderMove: (_, gs) => {
        // Match drawer pattern: Just track the finger position directly
        // Multiplier makes it feel more responsive (less physical distance needed)
        const newX = Math.max(-SCREEN_WIDTH, Math.min(0, -SCREEN_WIDTH + gs.dx * SWIPE_MULTIPLIER));
        mainViewTranslateX.setValue(newX);
      },
      onPanResponderRelease: async (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD || gs.vx > VELOCITY_THRESHOLD) {
          // Past threshold - check if we can go back (use ref to get latest callback)
          const canGoBack = checkBeforeBackRef.current ? await checkBeforeBackRef.current() : true;

          if (canGoBack) {
            // Complete slide-in animation then navigate
            Animated.timing(mainViewTranslateX, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }).start(() => {
              onBackRef.current();  // Use ref to get latest callback
            });
          } else {
            // User cancelled (e.g., discard dialog) - snap back
            Animated.timing(mainViewTranslateX, {
              toValue: -SCREEN_WIDTH,
              duration: 150,
              useNativeDriver: true,
            }).start();
          }
        } else {
          // Not past threshold - snap back
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
