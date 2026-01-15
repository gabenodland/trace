/**
 * useSwipeBackGesture
 *
 * iOS-style swipe-back gesture hook for navigating from sub-screens back to main views.
 * When user swipes right from anywhere on a sub-screen, the main view slides in from the left.
 *
 * Usage:
 * ```tsx
 * const { panHandlers, mainViewTranslateX, isSwipingBack } = useSwipeBackGesture({
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

import { useRef, useState, useEffect } from "react";
import { Animated, PanResponder, Dimensions, GestureResponderHandlers } from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH / 3;
const VELOCITY_THRESHOLD = 0.5;

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
  /** Whether user is currently swiping */
  isSwipingBack: boolean;
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
  const mainViewTranslateX = useRef(new Animated.Value(0)).current;
  const [isSwipingBack, setIsSwipingBack] = useState(false);

  // Refs for pan responder (avoid stale closures)
  const isEnabledRef = useRef(isEnabled);
  isEnabledRef.current = isEnabled;

  // Track modal state via ref for pan responder
  const isModalOpenRef = useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;

  // Reset animation when enabled state changes
  useEffect(() => {
    if (isEnabled) {
      // Sub-screen: main view off-screen to left
      mainViewTranslateX.setValue(-SCREEN_WIDTH);
    } else {
      // Main view: visible
      mainViewTranslateX.setValue(0);
    }
    setIsSwipingBack(false);
  }, [isEnabled, mainViewTranslateX]);

  const panResponder = useRef(
    PanResponder.create({
      // Don't capture initial touch - let children handle taps
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Don't capture when disabled or modal is open
        if (!isEnabledRef.current || isModalOpenRef.current) return false;
        // Require clear horizontal swipe to the right
        return gs.dx > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        setIsSwipingBack(true);
      },
      onPanResponderMove: (_, gs) => {
        // gs.dx: 0 -> SCREEN_WIDTH as user swipes right
        // translateX: -SCREEN_WIDTH -> 0 as main view slides in
        const newX = Math.max(-SCREEN_WIDTH, Math.min(0, -SCREEN_WIDTH + gs.dx));
        mainViewTranslateX.setValue(newX);
      },
      onPanResponderRelease: async (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD || gs.vx > VELOCITY_THRESHOLD) {
          // Past threshold - check if we can go back
          const canGoBack = checkBeforeBack ? await checkBeforeBack() : true;

          if (canGoBack) {
            // Complete slide-in animation then navigate
            Animated.timing(mainViewTranslateX, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }).start(() => {
              setIsSwipingBack(false);
              onBack();
            });
          } else {
            // User cancelled (e.g., discard dialog) - snap back
            Animated.timing(mainViewTranslateX, {
              toValue: -SCREEN_WIDTH,
              duration: 150,
              useNativeDriver: true,
            }).start(() => setIsSwipingBack(false));
          }
        } else {
          // Not past threshold - snap back
          Animated.timing(mainViewTranslateX, {
            toValue: -SCREEN_WIDTH,
            duration: 150,
            useNativeDriver: true,
          }).start(() => setIsSwipingBack(false));
        }
      },
      onPanResponderTerminate: () => {
        // Gesture interrupted - snap back to current state
        Animated.timing(mainViewTranslateX, {
          toValue: isEnabledRef.current ? -SCREEN_WIDTH : 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => setIsSwipingBack(false));
      },
    })
  ).current;

  return {
    panHandlers: panResponder.panHandlers,
    mainViewTranslateX,
    isSwipingBack,
    screenWidth: SCREEN_WIDTH,
  };
}
