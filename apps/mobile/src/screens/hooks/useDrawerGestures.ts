/**
 * useDrawerGestures - Handles swipe gestures for opening the stream drawer
 *
 * Uses BUBBLE phase (onMoveShouldSetPanResponder) so child ScrollViews
 * (e.g. horizontal table scroll) claim touches first. Only unclaimed
 * horizontal swipes bubble up to open the drawer.
 *
 * Same pattern as useSwipeBackGesture which is proven reliable.
 */

import { useRef, useEffect } from 'react';
import { PanResponder, Keyboard } from 'react-native';
import type { DrawerControl } from '../../shared/contexts/DrawerContext';
import { getIsModalOpen } from '../../shared/navigation';
import { getIsTableTouched } from '../../shared/hooks/useSwipeBackGesture';
import { getIsNativeTableTouched } from '../../modules/entries/helpers/htmlRenderers';

interface UseDrawerGesturesOptions {
  drawerControl: DrawerControl | null;
}

/** Minimum horizontal displacement before we recognize a swipe. */
const GESTURE_START_THRESHOLD = 12;

/** Android back gesture zone — OEMs vary from 20-60dp. Use 60 to be safe. */
const EDGE_ZONE = 60;

const DEFAULT_DRAWER_WIDTH = 280;

export function useDrawerGestures({ drawerControl }: UseDrawerGesturesOptions) {
  // Ref to hold current drawer control - needed because PanResponder callbacks
  // capture values at creation time, so we need ref to access current value
  const drawerControlRef = useRef(drawerControl);

  useEffect(() => {
    drawerControlRef.current = drawerControl;
  }, [drawerControl]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false,

      // Bubble phase — child ScrollViews (table horizontal scroll) claim
      // their touches first. Only unclaimed horizontal right-swipes reach here.
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (getIsModalOpen()) return false;
        if (getIsTableTouched()) return false;
        if (getIsNativeTableTouched()) return false;

        const isHorizontalSwipe =
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        const isSwipingRight = gestureState.dx > GESTURE_START_THRESHOLD;
        const notInEdgeZone = evt.nativeEvent.pageX > EDGE_ZONE;

        if (isHorizontalSwipe && isSwipingRight && notInEdgeZone) {
          Keyboard.dismiss();
          return true;
        }
        return false;
      },

      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        const control = drawerControlRef.current;
        if (control && gestureState.dx > 0) {
          control.setPosition(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const control = drawerControlRef.current;
        if (!control) return;
        const drawerWidth = control.getDrawerWidth() ?? DEFAULT_DRAWER_WIDTH;
        const shouldOpen =
          gestureState.dx > drawerWidth / 3 || gestureState.vx > 0.5;
        if (shouldOpen) {
          control.animateOpen(gestureState.vx);
        } else {
          control.animateClose();
        }
      },
      onPanResponderTerminate: () => {
        const control = drawerControlRef.current;
        if (control) control.animateClose();
      },
    })
  ).current;

  return {
    panHandlers: panResponder.panHandlers,
  };
}
