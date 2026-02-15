/**
 * NavigationService - Refs-based navigation for instant screen switching
 *
 * Design goals:
 * - 4 main screens (list, map, calendar, entryManagement) never re-render on navigation
 * - Only the screen container (AppContent) re-renders to update visibility
 * - navigate() is stable and never causes re-renders in screens
 * - Settings screens mount/unmount as needed
 */

import { createScopedLogger } from '../utils/logger';
const log = createScopedLogger('Navigation', '🧭');

export type MainScreen = 'inbox' | 'map' | 'calendar' | 'entryManagement';
export type SettingsScreen = 'account' | 'profile' | 'settings' | 'debug' | 'editorTest' |
  'tenTapTest' | 'editorV2Test' | 'dataFetchTest' | 'locations' | 'streams' |
  'stream-properties' | 'subscription' | 'capture';  // capture = legacy entry screen

// Use string for backward compatibility - screens use various string names
export type ScreenName = string;

// Main view screens - back from these exits app
const MAIN_VIEW_SCREENS: MainScreen[] = ['inbox', 'map', 'calendar'];

export interface NavigationParams {
  [key: string]: any;
}

export type BeforeBackHandler = () => Promise<boolean>;
type NavigationListener = () => void;

/**
 * Navigation state - stored in refs, not React state
 */
interface NavigationState {
  activeScreen: ScreenName;
  navParams: NavigationParams;
  lastMainView: MainScreen;
  isModalOpen: boolean;
  beforeBackHandler: BeforeBackHandler | null;
}

// Singleton state
const state: NavigationState = {
  activeScreen: 'inbox',
  navParams: {},
  lastMainView: 'inbox',
  isModalOpen: false,
  beforeBackHandler: null,
};

// Single listener (AppContent) that gets notified on screen changes
let listener: NavigationListener | null = null;

// Navigation version counter - increments on every intentional navigate/goBack call
// Used by AppContent to distinguish real navigation from remount-induced state changes
let navigationVersion = 0;

/**
 * Subscribe to navigation changes (only AppContent should use this)
 */
export function subscribeToNavigation(callback: NavigationListener): () => void {
  listener = callback;
  return () => {
    listener = null;
  };
}

/**
 * Notify listener that navigation changed
 */
function notifyListener(): void {
  listener?.();
}

/**
 * Navigate to a screen
 */
export function navigate(screen: ScreenName, params: NavigationParams = {}): void {
  // Handle "back" navigation specially
  if (screen === 'back' as ScreenName) {
    goBack();
    return;
  }

  navigationVersion++;

  log.info(`navigate to ${screen}`, {
    from: state.activeScreen,
    params,
    navVersion: navigationVersion,
  });

  // Update last main view if navigating to a main view
  if (MAIN_VIEW_SCREENS.includes(screen as MainScreen)) {
    state.lastMainView = screen as MainScreen;
  }

  state.activeScreen = screen;
  state.navParams = params;

  notifyListener();
}

/**
 * Go back to last main view
 */
export async function goBack(): Promise<void> {
  // Already on main view, nothing to do
  if (isOnMainView()) {
    return;
  }

  // Check if screen allows back navigation
  if (state.beforeBackHandler) {
    const canGoBack = await state.beforeBackHandler();
    if (!canGoBack) {
      return;
    }
  }

  navigationVersion++;

  state.activeScreen = state.lastMainView;
  state.navParams = {};

  log.info(`goBack to ${state.lastMainView}`);
  notifyListener();
}

/**
 * Check if currently on a main view (list, map, calendar)
 */
export function isOnMainView(): boolean {
  return MAIN_VIEW_SCREENS.includes(state.activeScreen as MainScreen);
}

/**
 * Get current active screen
 */
export function getActiveScreen(): ScreenName {
  return state.activeScreen;
}

/**
 * Get current navigation params
 */
export function getNavParams(): NavigationParams {
  return state.navParams;
}

/**
 * Get last main view (for swipe-back target)
 */
export function getLastMainView(): MainScreen {
  return state.lastMainView;
}

/**
 * Set before-back handler (for unsaved changes prompts)
 */
export function setBeforeBackHandler(handler: BeforeBackHandler | null): void {
  state.beforeBackHandler = handler;
}

/**
 * Check if back navigation is allowed
 */
export async function checkBeforeBack(): Promise<boolean> {
  if (state.beforeBackHandler) {
    return await state.beforeBackHandler();
  }
  return true;
}

/**
 * Set modal open state (disables swipe-back gesture)
 */
export function setIsModalOpen(open: boolean): void {
  state.isModalOpen = open;
}

/**
 * Check if a modal is open
 */
export function getIsModalOpen(): boolean {
  return state.isModalOpen;
}

/**
 * Get the current navigation version counter.
 * Increments on every intentional navigate() or goBack() call.
 * Used by AppContent to distinguish real navigation from remount-induced state changes.
 */
export function getNavigationVersion(): number {
  return navigationVersion;
}
