/**
 * NavigationService - Refs-based navigation for instant screen switching
 *
 * Design goals:
 * - 4 main screens (allEntries, map, calendar, entryManagement) never re-render on navigation
 * - Only the screen container (AppContent) re-renders to update visibility
 * - navigate() is stable and never causes re-renders in screens
 * - Settings screens mount/unmount as needed
 * - Back stack: goBack() pops to previous screen, not always to main view
 * - Swipe-back and main-view navigation resets the entire stack
 */

import { createScopedLogger } from '../utils/logger';
const log = createScopedLogger('Navigation', '🧭');

export type MainScreen = 'allEntries' | 'map' | 'calendar' | 'entryManagement';
export type SettingsScreen = 'account' | 'profile' | 'settings' | 'debug' |
  'editorV2Test' | 'locations' | 'streams' |
  'stream-properties' | 'subscription' | 'capture';  // capture = legacy entry screen

// Use string for backward compatibility - screens use various string names
export type ScreenName = string;

// Main view screens - back from these exits app
const MAIN_VIEW_SCREENS: MainScreen[] = ['allEntries', 'map', 'calendar'];

// Entry screens — persistent overlay, don't participate in back stack
const ENTRY_SCREENS = ['entryManagement', 'capture'];

export interface NavigationParams {
  [key: string]: any;
}

interface HistoryEntry {
  screen: ScreenName;
  params: NavigationParams;
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
  /** Back stack of visited sub-screens. Does not include main views or entry screens. */
  history: HistoryEntry[];
}

// Singleton state
const state: NavigationState = {
  activeScreen: 'allEntries',
  navParams: {},
  lastMainView: 'allEntries',
  isModalOpen: false,
  beforeBackHandler: null,
  history: [],
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
 *
 * Back stack behavior:
 * - Navigating to a main view (allEntries/map/calendar): clears entire history
 * - Navigating to entry screen: no history change (entry has its own back)
 * - Navigating to a sub-screen already in history: pops back to it (treats as back navigation)
 * - Navigating forward to a new sub-screen: pushes current screen onto history
 */
export function navigate(screen: ScreenName, params: NavigationParams = {}): void {
  // Handle "back" navigation specially
  if (screen === 'back' as ScreenName) {
    goBack();
    return;
  }

  navigationVersion++;

  const isTargetMainView = MAIN_VIEW_SCREENS.includes(screen as MainScreen);
  const isTargetEntryScreen = ENTRY_SCREENS.includes(screen);
  const isCurrentMainView = MAIN_VIEW_SCREENS.includes(state.activeScreen as MainScreen);
  const isCurrentEntryScreen = ENTRY_SCREENS.includes(state.activeScreen);

  log.info(`navigate to ${screen}`, {
    from: state.activeScreen,
    params,
    navVersion: navigationVersion,
    historyDepth: state.history.length,
  });

  if (isTargetMainView) {
    // Navigating to main view: clear history, update lastMainView
    state.lastMainView = screen as MainScreen;
    state.history = [];
  } else if (!isTargetEntryScreen) {
    // Navigating to a sub-screen (not entry)
    // Check if target is already in history — treat as navigating back
    const historyIndex = state.history.findIndex(h => h.screen === screen);
    if (historyIndex >= 0) {
      // Pop back to that point (discard everything after it)
      state.history = state.history.slice(0, historyIndex);
      log.info(`navigate-as-back to ${screen}`, { historyDepth: state.history.length });
    } else if (!isCurrentMainView && !isCurrentEntryScreen) {
      // Forward navigation from another sub-screen: push current onto history
      state.history.push({ screen: state.activeScreen, params: state.navParams });
    }
    // From main view or entry screen: don't push (main tracked by lastMainView, entry has own back)
  }
  // Entry screen: don't modify history

  state.activeScreen = screen;
  state.navParams = params;

  notifyListener();
}

/**
 * Go back one level in the navigation stack.
 * If history has entries, pops to the previous sub-screen.
 * If history is empty, returns to the last main view.
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

  if (state.history.length > 0) {
    // Pop to previous screen in history
    const prev = state.history.pop()!;
    state.activeScreen = prev.screen;
    state.navParams = prev.params;
    log.info(`goBack to ${prev.screen}`, { historyDepth: state.history.length });
  } else {
    // No history: return to last main view
    state.activeScreen = state.lastMainView;
    state.navParams = {};
    log.info(`goBack to main: ${state.lastMainView}`);
  }

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
 * Set modal open state (disables swipe-back and drawer gestures).
 * Uses a counter internally so nested sheets work correctly.
 */
let modalOpenCount = 0;
export function setIsModalOpen(open: boolean): void {
  modalOpenCount += open ? 1 : -1;
  if (modalOpenCount < 0) modalOpenCount = 0; // Safety
  state.isModalOpen = modalOpenCount > 0;
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
