/**
 * StreamDrawer
 *
 * Animated drawer component for stream switching.
 * Renders at app root level as an overlay.
 *
 * Features:
 * - Animated slide-in from left
 * - Backdrop with fade (derived from translateX via interpolation)
 * - Swipe-to-open gesture (from EntryListScreen via drawerControl)
 * - Tap backdrop to close
 * - Tab swiping handled by StreamDrawerContent's own PanResponder
 */

import { useRef, useEffect, useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  Platform,
  StatusBar,
} from "react-native";
import { useDrawer, useDrawerOpen, type DrawerControl } from "../../shared/contexts/DrawerContext";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { StreamDrawerContent } from "./StreamDrawerContent";
import { IOS_SPRING } from "../../shared/constants/animations";

const DRAWER_WIDTH = 300;

export function StreamDrawer() {
  const theme = useTheme();
  const { openDrawer, closeDrawer, registerDrawerControl } = useDrawer();
  const isOpen = useDrawerOpen();

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
      // Tighter thresholds than default IOS_SPRING (10px) — the drawer's final
      // position is on-screen, so stopping 10px short leaves a visible gap
      restDisplacementThreshold: 0.1,
      restSpeedThreshold: 0.1,
    }).start(({ finished }) => {
      if (animationIdRef.current !== myId) return;
      animationIdRef.current = 0;
      if (finished) setIsVisible(false);
    });
  }, [translateX, closeDrawer]);

  // Get drawer width
  const getDrawerWidth = useCallback(() => DRAWER_WIDTH, []);

  // Swipe-to-close on the drawer panel (left swipe)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dx < -10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          translateX.setValue(gs.dx);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -80 || gs.vx < -0.5) {
          animateClose(gs.vx);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            ...IOS_SPRING,
          }).start();
        }
      },
    })
  ).current;

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

  // Animate open/close based on state (for non-gesture triggers like button press, stream selection)
  // Gesture-driven animations are handled by animateClose/animateOpen directly.
  useEffect(() => {
    // Skip if we're being dragged or if animateClose/animateOpen is already handling it
    if (isDragging) return;
    if (animationIdRef.current !== 0) return;

    if (isOpen) {
      setIsVisible(true);
      Animated.spring(translateX, {
        toValue: 0,
        ...IOS_SPRING,
      }).start();
    } else {
      Animated.spring(translateX, {
        toValue: -DRAWER_WIDTH,
        ...IOS_SPRING,
        restDisplacementThreshold: 0.1,
        restSpeedThreshold: 0.1,
      }).start(({ finished }) => {
        if (finished) setIsVisible(false);
      });
    }
  }, [isOpen, isDragging]); // translateX is a stable ref

  // Always render the drawer - it starts off-screen (translateX = -DRAWER_WIDTH)
  // and backdrop is invisible (opacity = 0). Using pointerEvents to control interaction.
  // Interactive when open or visible (drag released, close animating) so the backdrop
  // blocks touches to entries underneath and tapping it dismisses the drawer.
  // Not using isDragging here — during active drag the EntryListScreen PanResponder
  // owns the gesture and we must not intercept its move events.
  return (
    <View style={styles.container} pointerEvents={isOpen || isVisible ? "auto" : "none"}>
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
        {...panResponder.panHandlers}
        style={[
          styles.drawer,
          { transform: [{ translateX }], backgroundColor: theme.colors.surface.overlay },
        ]}
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
