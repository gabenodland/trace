/**
 * Shared animation constants for gesture-driven interactions.
 */

/**
 * iOS-style critically damped spring config for interactive gesture release.
 * Based on react-navigation's TransitionIOSSpec open animation
 * (stiffness: 1000, damping: 500, mass: 3).
 *
 * Use for all gesture-release animations where velocity continuity matters.
 * Non-interactive animations (e.g., programmatic push) should use Animated.timing.
 */
export const IOS_SPRING = {
  stiffness: 1000,
  damping: 500,
  mass: 3,
  overshootClamping: true,
  restDisplacementThreshold: 10,
  restSpeedThreshold: 10,
  useNativeDriver: true,
} as const;
