/**
 * StreamDrawer
 *
 * Animated drawer component for stream switching.
 * Renders at app root level as an overlay.
 *
 * Features:
 * - Animated slide-in from left
 * - Backdrop with fade
 * - Swipe-to-close gesture
 * - Tap backdrop to close
 */

import { useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  PanResponder,
  Platform,
  StatusBar,
} from "react-native";
import { useDrawer } from "../../shared/contexts/DrawerContext";
import { StreamDrawerContent } from "./StreamDrawerContent";

const DRAWER_WIDTH = 280;

export function StreamDrawer() {
  const { isOpen, closeDrawer } = useDrawer();

  // Animation values
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Track if drawer is currently visible (for pointer events)
  const isVisible = useRef(false);

  // Swipe-to-close gesture - only captures swipe movements, not taps
  const panResponder = useRef(
    PanResponder.create({
      // Don't capture initial touch - let children handle taps
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture horizontal swipes to the left
        return gestureState.dx < -10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swiping left (closing)
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Close if swiped far enough or fast enough
        if (gestureState.dx < -80 || gestureState.vx < -0.5) {
          closeDrawer();
        } else {
          // Snap back open
          Animated.timing(translateX, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Animate open/close - use timing instead of spring for faster, predictable animation
  useEffect(() => {
    if (isOpen) {
      isVisible.current = true;
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isVisible.current = false;
      });
    }
  }, [isOpen, translateX, backdropOpacity]);

  // Don't render anything if not visible
  if (!isOpen && !isVisible.current) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents={isOpen ? "auto" : "none"}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={closeDrawer}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropOpacity },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <StreamDrawerContent />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "#ffffff",
    paddingTop: Platform.OS === "ios" ? 40 : (StatusBar.currentHeight || 24) + 4,
    // Shadow on right edge
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 16,
  },
});
