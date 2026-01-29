/**
 * useDrawerGestures - Handles swipe gestures for opening the stream drawer
 * Extracts PanResponder logic from EntryListScreen
 */

import { useRef, useEffect } from 'react';
import { PanResponder, Dimensions } from 'react-native';
import type { DrawerControl } from '../../shared/contexts/DrawerContext';

interface UseDrawerGesturesOptions {
  drawerControl: DrawerControl | null;
}

export function useDrawerGestures({ drawerControl }: UseDrawerGesturesOptions) {
  const screenWidth = Dimensions.get('window').width;
  const DRAWER_SWIPE_THRESHOLD = screenWidth / 3;

  // Ref to hold current drawer control - needed because PanResponder callbacks
  // capture values at creation time, so we need ref to access current value
  const drawerControlRef = useRef(drawerControl);

  useEffect(() => {
    drawerControlRef.current = drawerControl;
  }, [drawerControl]);

  // Track if we're actively swiping
  const isSwipingDrawer = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Capture horizontal swipes before FlatList
      // IMPORTANT: Avoid Android's edge gesture zones (~60px from each edge)
      // to prevent accidental back navigation when swiping for drawers
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        const isSwipingRight = gestureState.dx > 20;

        // Android back gesture zone is ~20-40dp from edge, use 60px to be safe
        const EDGE_ZONE = 60;
        const touchX = evt.nativeEvent.pageX;
        const notInLeftEdge = touchX > EDGE_ZONE;

        // Swipe right for stream drawer (avoid left edge back zone)
        if (isHorizontalSwipe && isSwipingRight && notInLeftEdge) {
          isSwipingDrawer.current = true;
          return true;
        }
        return false;
      },
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {
        // No setup needed
      },
      onPanResponderMove: (_, gestureState) => {
        if (isSwipingDrawer.current) {
          const control = drawerControlRef.current;
          if (control && gestureState.dx > 0) {
            control.setPosition(gestureState.dx);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isSwipingDrawer.current) {
          const control = drawerControlRef.current;
          if (!control) return;
          const shouldOpen = gestureState.dx > DRAWER_SWIPE_THRESHOLD || gestureState.vx > 0.5;
          if (shouldOpen) {
            control.animateOpen();
          } else {
            control.animateClose();
          }
        }
        isSwipingDrawer.current = false;
      },
      onPanResponderTerminate: () => {
        if (isSwipingDrawer.current) {
          const control = drawerControlRef.current;
          if (control) control.animateClose();
        }
        isSwipingDrawer.current = false;
      },
    })
  ).current;

  return {
    panHandlers: panResponder.panHandlers,
  };
}
