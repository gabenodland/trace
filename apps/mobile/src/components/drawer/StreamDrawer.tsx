/**
 * StreamDrawer
 *
 * Animated drawer component for stream switching.
 * Renders at app root level as an overlay.
 *
 * Features:
 * - Animated slide-in from left
 * - Backdrop with fade (derived from translateX via interpolation)
 * - Swipe-to-close gesture (on drawer itself)
 * - Swipe-to-open gesture (from EntryListScreen via drawerControl)
 * - Tap backdrop to close
 */

import { useRef, useEffect, useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  PanResponder,
  Platform,
  StatusBar,
} from "react-native";
import { useDrawer, type DrawerControl } from "../../shared/contexts/DrawerContext";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { StreamDrawerContent } from "./StreamDrawerContent";
import { IOS_SPRING } from "../../shared/constants/animations";

const DRAWER_WIDTH = 280;

export function StreamDrawer() {
  const theme = useTheme();
  const { isOpen, openDrawer, closeDrawer, registerDrawerControl } = useDrawer();

  // Single animation value — backdrop opacity is derived via interpolation
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = translateX.interpolate({
    inputRange: [-DRAWER_WIDTH, 0],
    outputRange: [0, 0.5],
  });

  // Track if drawer is currently visible (for pointer events)
  // Using state instead of ref so changes trigger re-render and update pointerEvents
  const [isVisible, setIsVisible] = useState(false);
  // Track if being dragged externally (swipe-to-open from list)
  const [isDragging, setIsDragging] = useState(false);
  // Counter to prevent useEffect from double-firing animations when animateClose/animateOpen already started them.
  // Using a counter instead of a boolean so interrupted animation callbacks can detect they're stale.
  const animationIdRef = useRef(0);

  // Set drawer position directly (for external gesture control)
  // Position is in terms of how far drawer has moved: 0 = fully closed, DRAWER_WIDTH = fully open
  const setPosition = useCallback((position: number) => {
    setIsDragging(true);
    setIsVisible(true);
    // translateX goes from -DRAWER_WIDTH (closed) to 0 (open)
    // position goes from 0 (closed) to DRAWER_WIDTH (open)
    const clampedPosition = Math.max(0, Math.min(position, DRAWER_WIDTH));
    translateX.setValue(-DRAWER_WIDTH + clampedPosition);
    // Backdrop opacity follows automatically via interpolation
  }, [translateX]);

  // Animate drawer to open position with spring carrying gesture velocity
  const animateOpen = useCallback((velocity?: number) => {
    const myId = ++animationIdRef.current;
    setIsDragging(false);
    setIsVisible(true);
    openDrawer(); // Update state
    Animated.spring(translateX, {
      toValue: 0,
      velocity: velocity ?? 0,
      ...IOS_SPRING,
    }).start(() => {
      if (animationIdRef.current !== myId) return;
      animationIdRef.current = 0;
    });
  }, [translateX, openDrawer]);

  // Animate drawer to closed position with spring carrying gesture velocity
  const animateClose = useCallback((velocity?: number) => {
    const myId = ++animationIdRef.current;
    setIsDragging(false);
    closeDrawer(); // Update state
    Animated.spring(translateX, {
      toValue: -DRAWER_WIDTH,
      velocity: velocity ?? 0,
      ...IOS_SPRING,
    }).start(({ finished }) => {
      if (animationIdRef.current !== myId) return;
      animationIdRef.current = 0;
      if (finished) setIsVisible(false);
    });
  }, [translateX, closeDrawer]);

  // Get drawer width
  const getDrawerWidth = useCallback(() => DRAWER_WIDTH, []);

  // Register control methods on mount
  useEffect(() => {
    const control: DrawerControl = {
      setPosition,
      animateOpen,
      animateClose,
      getDrawerWidth,
    };
    registerDrawerControl(control);
    return () => registerDrawerControl(null);
  }, [setPosition, animateOpen, animateClose, getDrawerWidth, registerDrawerControl]);

  // Swipe-to-close gesture on drawer itself - only captures swipe movements, not taps
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
          // Backdrop opacity follows automatically via interpolation
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Close if swiped far enough or fast enough
        if (gestureState.dx < -80 || gestureState.vx < -0.5) {
          animateClose(gestureState.vx);
        } else {
          // Didn't pass close threshold — spring back open without velocity
          Animated.spring(translateX, {
            toValue: 0,
            ...IOS_SPRING,
          }).start();
        }
      },
    })
  ).current;

  // Animate open/close based on state (for non-gesture triggers like button press, stream selection)
  // Gesture-driven animations are handled by animateClose/animateOpen directly.
  useEffect(() => {
    // Skip if we're being dragged or if animateClose/animateOpen is already handling it
    if (isDragging) return;
    if (animationIdRef.current !== 0) return;

    if (isOpen) {
      setIsVisible(true);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateX, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setIsVisible(false);
      });
    }
  }, [isOpen, isDragging]); // translateX is a stable ref

  // Always render the drawer - it starts off-screen (translateX = -DRAWER_WIDTH)
  // and backdrop is invisible (opacity = 0). Using pointerEvents to control interaction.
  // This ensures the drawer is ready to respond immediately to swipe gestures.
  const isActive = isOpen || isVisible || isDragging;

  return (
    <View style={styles.container} pointerEvents={isActive ? "auto" : "none"}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={() => animateClose()}>
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
          { transform: [{ translateX }], backgroundColor: theme.colors.surface.overlay },
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
    paddingTop: Platform.OS === "ios" ? 40 : (StatusBar.currentHeight || 24) + 4,
    // Shadow on right edge
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 16,
  },
});
