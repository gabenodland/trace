/**
 * Navigation module - Refs-based navigation for instant screen switching
 *
 * Usage:
 * - Screens: import { useNavigate } from '../shared/navigation'
 * - AppContent: import { useNavigationState } from '../shared/navigation'
 */

// Service functions (for direct use if needed)
export {
  navigate,
  goBack,
  isOnMainView,
  getActiveScreen,
  getNavParams,
  getLastMainView,
  setBeforeBackHandler,
  checkBeforeBack,
  setIsModalOpen,
  getIsModalOpen,
  getNavigationVersion,
  type ScreenName,
  type MainScreen,
  type SettingsScreen,
  type NavigationParams,
  type BeforeBackHandler,
} from './NavigationService';

// Hooks
export {
  useNavigate,
  useGoBack,
  useActiveScreen,
  useBeforeBack,
  useCheckBeforeBack,
  useModalState,
  useNavigationState,
} from './hooks';
