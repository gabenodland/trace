/**
 * Navigation hooks - Stable hooks that don't cause re-renders
 *
 * useNavigate() - Returns stable navigate function (use in all screens)
 * useActiveScreen() - Subscribes to screen changes (use in AppContent only)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  navigate,
  goBack,
  subscribeToNavigation,
  getActiveScreen,
  getNavParams,
  getLastMainView,
  isOnMainView,
  setBeforeBackHandler,
  checkBeforeBack,
  setIsModalOpen,
  getIsModalOpen,
  type ScreenName,
  type NavigationParams,
  type BeforeBackHandler,
  type MainScreen,
} from './NavigationService';

/**
 * Stable navigate function - NEVER causes re-renders
 * Use this in all screens that need to navigate
 */
export function useNavigate() {
  // Return stable reference - navigate function never changes
  // Use string type for backward compatibility with existing code
  return useCallback((screen: string, params?: NavigationParams) => {
    navigate(screen, params);
  }, []);
}

/**
 * Stable goBack function - NEVER causes re-renders
 */
export function useGoBack() {
  return useCallback(() => {
    goBack();
  }, []);
}

/**
 * Subscribe to active screen changes - ONLY for AppContent
 * This is the only hook that causes re-renders on navigation
 */
export function useActiveScreen() {
  // Force re-render when navigation changes
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToNavigation(() => {
      forceUpdate(n => n + 1);
    });
    return unsubscribe;
  }, []);

  return {
    activeScreen: getActiveScreen(),
    navParams: getNavParams(),
    lastMainView: getLastMainView(),
    isOnMainView: isOnMainView(),
  };
}

/**
 * Set a before-back handler for unsaved changes prompts
 */
export function useBeforeBack(handler: BeforeBackHandler | null) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (handler) {
      setBeforeBackHandler(() => handlerRef.current!());
      return () => setBeforeBackHandler(null);
    }
  }, [!!handler]);
}

/**
 * Get check-before-back function for swipe gesture
 */
export function useCheckBeforeBack() {
  return checkBeforeBack;
}

/**
 * Modal state management for disabling swipe-back during modals
 */
export function useModalState() {
  return {
    isModalOpen: getIsModalOpen(),
    setIsModalOpen,
  };
}

/**
 * Full navigation state for AppContent (combines all needed values)
 * This is the ONLY place that re-renders on navigation
 */
export function useNavigationState() {
  const { activeScreen, navParams, lastMainView, isOnMainView: onMainView } = useActiveScreen();
  const navigateFn = useNavigate();
  const goBackFn = useGoBack();

  return {
    activeTab: activeScreen,  // Keep old name for compatibility during migration
    navParams,
    navigate: navigateFn,
    goBack: goBackFn,
    checkBeforeBack,
    isModalOpen: getIsModalOpen(),
    setIsModalOpen,
    isOnMainView: onMainView,
    lastMainView,
    setBeforeBackHandler,
  };
}
