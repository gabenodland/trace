/**
 * BottomSheet - Animated bottom sheet component
 *
 * A reusable bottom sheet that slides up from the bottom of the screen.
 * Supports multiple height presets (detents) and swipe-to-dismiss.
 */

import { useRef, useEffect, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  Keyboard,
  Platform,
  Modal,
} from "react-native";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { themeBase } from "../../shared/theme/themeBase";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const ANIMATION_DURATION = 250;

// Height presets (detents) as percentage of screen height
export type SheetHeight = "auto" | "small" | "medium" | "large" | "full" | number;

const HEIGHT_VALUES: Record<Exclude<SheetHeight, "auto" | number>, number> = {
  small: 0.3,   // 30% of screen
  medium: 0.5,  // 50% of screen
  large: 0.75,  // 75% of screen
  full: 0.95,   // 95% of screen (small gap at top)
};

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Height preset or percentage (0-1) or "auto" for content-based */
  height?: SheetHeight;
  /** Show grabber bar at top */
  showGrabber?: boolean;
  /** Allow swipe down to dismiss */
  swipeToDismiss?: boolean;
  /** Where swipe gesture is active: "grabber" (default) or "full" sheet. Use "grabber" when content has scrollable areas */
  swipeArea?: "grabber" | "full";
  /** Dismiss keyboard when opening (default: true). Set to false to allow sheet to appear over keyboard */
  dismissKeyboard?: boolean;
  /** Use Modal wrapper (default: true). Set to false to render inline for z-order control (parent view can slide over sheet) */
  useModal?: boolean;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  height = "auto",
  showGrabber = true,
  swipeToDismiss = true,
  swipeArea = "grabber",
  dismissKeyboard = true,
  useModal = true,
}: BottomSheetProps) {
  const dynamicTheme = useTheme();

  // Animation values
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Calculate actual height in pixels
  const getSheetHeight = useCallback(() => {
    if (height === "auto") return undefined; // Let content determine height
    if (typeof height === "number") return SCREEN_HEIGHT * height;
    return SCREEN_HEIGHT * HEIGHT_VALUES[height];
  }, [height]);

  const sheetHeight = getSheetHeight();

  // Pan responder for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => swipeToDismiss,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes
        return swipeToDismiss && gestureState.dy > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down more than 100px or with velocity, dismiss
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closeSheet();
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const openSheet = useCallback(() => {
    if (dismissKeyboard) {
      Keyboard.dismiss();
    }
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity, dismissKeyboard]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [translateY, backdropOpacity, onClose]);

  useEffect(() => {
    if (visible) {
      openSheet();
    }
  }, [visible, openSheet]);

  if (!visible) return null;

  // Shared content for both modal and inline rendering
  const sheetContent = (
    <View style={[styles.container, !useModal && styles.inlineContainer]}>
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          { opacity: backdropOpacity },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={closeSheet}
        />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: dynamicTheme.colors.background.primary,
            height: sheetHeight,
            maxHeight: SCREEN_HEIGHT * 0.95,
            transform: [{ translateY }],
          },
        ]}
        {...(swipeToDismiss && swipeArea === "full" ? panResponder.panHandlers : {})}
      >
        {/* Grabber bar - pan handlers on grabber when swipeArea="grabber" to avoid scroll conflicts */}
        {showGrabber && (
          <View
            style={styles.grabberContainer}
            {...(swipeToDismiss && swipeArea === "grabber" ? panResponder.panHandlers : {})}
          >
            <View
              style={[
                styles.grabber,
                { backgroundColor: dynamicTheme.colors.border.medium },
              ]}
            />
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {children}
        </View>
      </Animated.View>
    </View>
  );

  // Render with or without Modal wrapper
  if (useModal) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="none"
        statusBarTranslucent={true}
        onRequestClose={closeSheet}
      >
        {sheetContent}
      </Modal>
    );
  }

  // Inline rendering - respects parent z-order
  return sheetContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inlineContainer: {
    // For non-modal rendering, position absolutely to cover parent
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: themeBase.borderRadius.xl,
    borderTopRightRadius: themeBase.borderRadius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    overflow: "hidden",
  },
  grabberContainer: {
    alignItems: "center",
    paddingVertical: themeBase.spacing.sm,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
});
