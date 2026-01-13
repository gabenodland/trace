/**
 * useSwipeModeChanger
 *
 * Generic hook for cycling through modes via left swipe gesture.
 * Shows a badge sliding in from the right during swipe with the next mode label.
 *
 * Usage:
 * ```tsx
 * const { panHandlers, renderModeBadge } = useSwipeModeChanger({
 *   modes: ENTRY_DISPLAY_MODES,
 *   currentMode: displayMode,
 *   onModeChange: (mode) => setStreamSortPreference(streamId, { displayMode: mode }),
 * });
 *
 * <View {...panHandlers}>
 *   {content}
 *   {renderModeBadge()}
 * </View>
 * ```
 */

import { useRef, useState, useCallback } from "react";
import {
  Animated,
  PanResponder,
  Dimensions,
  View,
  Text,
  StyleSheet,
  GestureResponderHandlers,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { themeBase } from "../theme/themeBase";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH / 4; // 25% of screen
const VELOCITY_THRESHOLD = 0.5;
const BADGE_WIDTH = 120;

interface ModeOption<T extends string> {
  value: T;
  label: string;
}

interface UseSwipeModeChangerOptions<T extends string> {
  /** Array of mode options with value and label */
  modes: ModeOption<T>[];
  /** Current mode value */
  currentMode: T;
  /** Callback when mode changes */
  onModeChange: (mode: T) => void;
  /** Whether the swipe is enabled (default: true) */
  isEnabled?: boolean;
}

interface UseSwipeModeChangerResult {
  /** Spread these on the container View */
  panHandlers: GestureResponderHandlers;
  /** Call this to render the mode badge overlay */
  renderModeBadge: () => React.ReactNode;
  /** Whether user is currently swiping */
  isSwiping: boolean;
}

export function useSwipeModeChanger<T extends string>({
  modes,
  currentMode,
  onModeChange,
  isEnabled = true,
}: UseSwipeModeChangerOptions<T>): UseSwipeModeChangerResult {
  const theme = useTheme();

  // Badge animation: slides in from right (SCREEN_WIDTH to SCREEN_WIDTH - BADGE_WIDTH - padding)
  const badgeTranslateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const [isSwiping, setIsSwiping] = useState(false);

  // Refs for pan responder
  const isEnabledRef = useRef(isEnabled);
  isEnabledRef.current = isEnabled;

  // Get next mode in cycle
  const getNextMode = useCallback((): ModeOption<T> => {
    const currentIndex = modes.findIndex((m) => m.value === currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    return modes[nextIndex];
  }, [modes, currentMode]);

  const nextMode = getNextMode();

  // Reset badge to hidden position
  const resetBadge = useCallback(() => {
    Animated.parallel([
      Animated.timing(badgeTranslateX, {
        toValue: SCREEN_WIDTH,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(badgeOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => setIsSwiping(false));
  }, [badgeTranslateX, badgeOpacity]);

  const panResponder = useRef(
    PanResponder.create({
      // Don't capture initial touch
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only capture LEFT swipes when enabled
        if (!isEnabledRef.current) return false;
        // Require clear horizontal swipe to the left
        return gs.dx < -15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        setIsSwiping(true);
      },
      onPanResponderMove: (_, gs) => {
        // gs.dx: 0 -> -SCREEN_WIDTH as user swipes left
        // Badge slides in from right: starts at SCREEN_WIDTH, ends at SCREEN_WIDTH - BADGE_WIDTH - padding
        const progress = Math.min(1, Math.abs(gs.dx) / SWIPE_THRESHOLD);
        const targetX = SCREEN_WIDTH - BADGE_WIDTH - 16; // 16px from right edge
        const newX = SCREEN_WIDTH - progress * (SCREEN_WIDTH - targetX);

        badgeTranslateX.setValue(newX);
        badgeOpacity.setValue(Math.min(1, progress * 1.5)); // Fade in faster
      },
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) > SWIPE_THRESHOLD || Math.abs(gs.vx) > VELOCITY_THRESHOLD) {
          // Past threshold - change mode
          // First animate badge fully visible briefly
          Animated.sequence([
            Animated.parallel([
              Animated.timing(badgeTranslateX, {
                toValue: SCREEN_WIDTH - BADGE_WIDTH - 16,
                duration: 100,
                useNativeDriver: true,
              }),
              Animated.timing(badgeOpacity, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
              }),
            ]),
            // Brief pause to show selection
            Animated.delay(150),
          ]).start(() => {
            onModeChange(nextMode.value);
            resetBadge();
          });
        } else {
          // Not past threshold - cancel
          resetBadge();
        }
      },
      onPanResponderTerminate: () => {
        resetBadge();
      },
    })
  ).current;

  // Render the badge overlay
  const renderModeBadge = useCallback(() => {
    if (!isSwiping) return null;

    return (
      <Animated.View
        style={[
          styles.badgeContainer,
          {
            transform: [{ translateX: badgeTranslateX }],
            opacity: badgeOpacity,
            backgroundColor: theme.colors.functional.accent,
          },
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.badgeText, { color: "#fff" }]}>
          {nextMode.label}
        </Text>
        <Text style={[styles.badgeArrow, { color: "#fff" }]}>
          →
        </Text>
      </Animated.View>
    );
  }, [isSwiping, badgeTranslateX, badgeOpacity, nextMode.label, theme]);

  return {
    panHandlers: panResponder.panHandlers,
    renderModeBadge,
    isSwiping,
  };
}

const styles = StyleSheet.create({
  badgeContainer: {
    position: "absolute",
    top: "50%",
    right: 0,
    width: BADGE_WIDTH,
    marginTop: -20, // Half of badge height
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.md,
    borderTopLeftRadius: themeBase.borderRadius.lg,
    borderBottomLeftRadius: themeBase.borderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  badgeArrow: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
