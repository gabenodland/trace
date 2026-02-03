import { useState, useEffect, useRef } from "react";
import { Keyboard, Platform, KeyboardEvent } from "react-native";

interface UseKeyboardHeightOptions {
  /**
   * Called when keyboard appears with the keyboard height.
   * Use this for side effects like scrolling content into view.
   * Note: This callback is stored in a ref, so it always uses the latest value
   * without causing listener re-registration.
   */
  onShow?: (height: number) => void;
  /**
   * Called when keyboard hides.
   */
  onHide?: () => void;
}

/**
 * useKeyboardHeight - Tracks keyboard visibility and height
 *
 * Cross-platform hook that handles iOS (keyboardWillShow/Hide) and
 * Android (keyboardDidShow/Hide) differences.
 *
 * The callbacks are stored in refs, so they always use the latest closure
 * values without causing listener re-registration.
 *
 * Usage:
 * ```
 * const keyboardHeight = useKeyboardHeight({
 *   onShow: () => {
 *     // This always has access to current state/refs
 *     if (editorRef.current && !activePicker) {
 *       editorRef.current.scrollToCursor();
 *     }
 *   },
 * });
 *
 * // In styles:
 * { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 0 }
 * ```
 */
export function useKeyboardHeight(options?: UseKeyboardHeightOptions): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Store callbacks in refs so we don't re-register listeners when they change
  const onShowRef = useRef(options?.onShow);
  const onHideRef = useRef(options?.onHide);

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onShowRef.current = options?.onShow;
    onHideRef.current = options?.onHide;
  });

  useEffect(() => {
    // iOS fires "will" events (before animation), Android fires "did" events (after)
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const handleShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates.height;
      setKeyboardHeight(height);
      onShowRef.current?.(height);
    };

    const handleHide = () => {
      setKeyboardHeight(0);
      onHideRef.current?.();
    };

    const showListener = Keyboard.addListener(showEvent, handleShow);
    const hideListener = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []); // Empty deps - listeners registered once, callbacks accessed via refs

  return keyboardHeight;
}
