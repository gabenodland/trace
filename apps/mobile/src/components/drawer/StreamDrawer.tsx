/**
 * StreamDrawer
 *
 * Animated drawer component for stream switching.
 * Renders at app root level as an overlay.
 *
 * Features:
 * - Animated slide-in from left
 * - Backdrop with fade
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
import { StreamDrawerContent } from "./StreamDrawerContent";

const DRAWER_WIDTH = 280;

export function StreamDrawer() {
  const { isOpen, openDrawer, closeDrawer, registerDrawerControl } = useDrawer();

  // Animation values
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Track if drawer is currently visible (for pointer events)
  // Using state instead of ref so changes trigger re-render and update pointerEvents
  const [isVisible, setIsVisible] = useState(false);
  // Track if being dragged externally (swipe-to-open from list)
  const [isDragging, setIsDragging] = useState(false);

  // Set drawer position directly (for external gesture control)
  // Position is in terms of how far drawer has moved: 0 = fully closed, DRAWER_WIDTH = fully open
  const setPosition = useCallback((position: number) => {
    setIsDragging(true);
    setIsVisible(true);
    // translateX goes from -DRAWER_WIDTH (closed) to 0 (open)
    // position goes from 0 (closed) to DRAWER_WIDTH (open)
    const clampedPosition = Math.max(0, Math.min(position, DRAWER_WIDTH));
    translateX.setValue(-DRAWER_WIDTH + clampedPosition);
    // Backdrop opacity: 0 when closed, 0.5 when open
    backdropOpacity.setValue((clampedPosition / DRAWER_WIDTH) * 0.5);
  }, [translateX, backdropOpacity]);

  // Animate drawer to open position
  const animateOpen = useCallback(() => {
    setIsDragging(false);
    setIsVisible(true);
    openDrawer(); // Update state
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
  }, [translateX, backdropOpacity, openDrawer]);

  // Animate drawer to closed position
  const animateClose = useCallback(() => {
    setIsDragging(false);
    closeDrawer(); // Update state
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
      setIsVisible(false);
    });
  }, [translateX, backdropOpacity, closeDrawer]);

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
          // Also update backdrop
          const progress = Math.max(0, 1 + gestureState.dx / DRAWER_WIDTH);
          backdropOpacity.setValue(progress * 0.5);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Close if swiped far enough or fast enough
        if (gestureState.dx < -80 || gestureState.vx < -0.5) {
          animateClose();
        } else {
          // Snap back open
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0.5,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // Animate open/close based on state (for non-gesture triggers like button press)
  useEffect(() => {
    // Skip if we're being dragged - let the gesture control position
    if (isDragging) return;

    if (isOpen) {
      setIsVisible(true);
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
        setIsVisible(false);
      });
    }
  }, [isOpen, isDragging, translateX, backdropOpacity]);

  // Always render the drawer - it starts off-screen (translateX = -DRAWER_WIDTH)
  // and backdrop is invisible (opacity = 0). Using pointerEvents to control interaction.
  // This ensures the drawer is ready to respond immediately to swipe gestures.
  const isActive = isOpen || isVisible || isDragging;

  return (
    <View style={styles.container} pointerEvents={isActive ? "auto" : "none"}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={animateClose}>
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
