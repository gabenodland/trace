/**
 * useDrawerGestures - Handles swipe gestures for opening drawers
 * Extracts PanResponder logic from EntryListScreen
 */

import { useRef, useEffect } from 'react';
import { PanResponder, Dimensions } from 'react-native';
import type { DrawerControl } from '../../shared/contexts/DrawerContext';

interface UseDrawerGesturesOptions {
  drawerControl: DrawerControl | null;
  settingsDrawerControl: DrawerControl | null;
}

export function useDrawerGestures({ drawerControl, settingsDrawerControl }: UseDrawerGesturesOptions) {
  const screenWidth = Dimensions.get('window').width;
  const DRAWER_SWIPE_THRESHOLD = screenWidth / 3;

  // Refs to hold current drawer controls - needed because PanResponder callbacks
  // capture values at creation time, so we need refs to access current values
  const drawerControlRef = useRef(drawerControl);
  const settingsDrawerControlRef = useRef(settingsDrawerControl);

  useEffect(() => {
    drawerControlRef.current = drawerControl;
  }, [drawerControl]);

  useEffect(() => {
    settingsDrawerControlRef.current = settingsDrawerControl;
  }, [settingsDrawerControl]);

  // Track which drawer we're swiping (null = none, 'stream' = left, 'settings' = right)
  const activeSwipeDrawer = useRef<'stream' | 'settings' | null>(null);

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
        const isSwipingLeft = gestureState.dx < -20;

        // Android back gesture zone is ~20-40dp from edge, use 60px to be safe
        const EDGE_ZONE = 60;
        const touchX = evt.nativeEvent.pageX;
        const notInLeftEdge = touchX > EDGE_ZONE;
        const notInRightEdge = touchX < screenWidth - EDGE_ZONE;

        // Swipe right for stream drawer (avoid left edge back zone)
        if (isHorizontalSwipe && isSwipingRight && notInLeftEdge) {
          activeSwipeDrawer.current = 'stream';
          return true;
        }
        // Swipe left for settings drawer (avoid right edge)
        if (isHorizontalSwipe && isSwipingLeft && notInRightEdge) {
          activeSwipeDrawer.current = 'settings';
          return true;
        }
        return false;
      },
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {
        // No setup needed
      },
      onPanResponderMove: (_, gestureState) => {
        if (activeSwipeDrawer.current === 'stream') {
          const control = drawerControlRef.current;
          if (control && gestureState.dx > 0) {
            control.setPosition(gestureState.dx);
          }
        } else if (activeSwipeDrawer.current === 'settings') {
          const control = settingsDrawerControlRef.current;
          if (control && gestureState.dx < 0) {
            // Convert negative dx to positive position
            control.setPosition(-gestureState.dx);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (activeSwipeDrawer.current === 'stream') {
          const control = drawerControlRef.current;
          if (!control) return;
          const shouldOpen = gestureState.dx > DRAWER_SWIPE_THRESHOLD || gestureState.vx > 0.5;
          if (shouldOpen) {
            control.animateOpen();
          } else {
            control.animateClose();
          }
        } else if (activeSwipeDrawer.current === 'settings') {
          const control = settingsDrawerControlRef.current;
          if (!control) return;
          const shouldOpen = -gestureState.dx > DRAWER_SWIPE_THRESHOLD || gestureState.vx < -0.5;
          if (shouldOpen) {
            control.animateOpen();
          } else {
            control.animateClose();
          }
        }
        activeSwipeDrawer.current = null;
      },
      onPanResponderTerminate: () => {
        if (activeSwipeDrawer.current === 'stream') {
          const control = drawerControlRef.current;
          if (control) control.animateClose();
        } else if (activeSwipeDrawer.current === 'settings') {
          const control = settingsDrawerControlRef.current;
          if (control) control.animateClose();
        }
        activeSwipeDrawer.current = null;
      },
    })
  ).current;

  return {
    panHandlers: panResponder.panHandlers,
  };
}
