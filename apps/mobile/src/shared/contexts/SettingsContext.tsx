/**
 * Settings Context - Unified settings management with AsyncStorage persistence
 *
 * Provides settings throughout the app via React Context.
 * All settings are stored as a single JSON object for efficient persistence.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type UserSettings,
  type StreamSortPreference,
  type StreamViewFilter,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  mergeWithDefaults,
  DEFAULT_SORT_MODE,
  DEFAULT_SORT_ORDER,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_STREAM_VIEW_FILTER,
} from '@trace/core';

// Debounce delay for saving settings (ms)
const SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface SettingsContextValue {
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
  resetSettings: () => void;
  isLoaded: boolean;
  // Stream sort preference helpers
  getStreamSortPreference: (streamId: string | null) => StreamSortPreference;
  setStreamSortPreference: (streamId: string | null, pref: Partial<StreamSortPreference>) => void;
  // Stream filter helpers (convenience wrappers)
  getStreamFilter: (streamId: string | null) => StreamViewFilter;
  setStreamFilter: (streamId: string | null, filter: Partial<StreamViewFilter>) => void;
  resetStreamFilter: (streamId: string | null) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface SettingsProviderProps {
  children: React.ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Merge with defaults to ensure all fields exist
          const merged = mergeWithDefaults(parsed, DEFAULT_SETTINGS);
          setSettings(merged);
          console.log('[SettingsContext] Loaded settings:', merged);
        } else {
          console.log('[SettingsContext] No stored settings, using defaults');
        }
      } catch (error) {
        console.error('[SettingsContext] Error loading settings:', error);
        // Use defaults on error
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoaded(true);
      }
    }

    loadSettings();
  }, []);

  // Save settings to AsyncStorage with debounce (prevents lag when clicking rapidly)
  useEffect(() => {
    if (!isLoaded) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the save - UI updates instantly, storage write is batched
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        console.log('[SettingsContext] Saved settings (debounced)');
      } catch (error) {
        console.error('[SettingsContext] Error saving settings:', error);
      }
    }, SAVE_DEBOUNCE_MS);

    // Cleanup on unmount or before next effect
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [settings, isLoaded]);

  // Update one or more settings
  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Default view preference for streams without a stored preference
  const defaultSortPreference: StreamSortPreference = {
    sortMode: DEFAULT_SORT_MODE,
    sortOrder: DEFAULT_SORT_ORDER,
    showPinnedFirst: false,
    displayMode: DEFAULT_DISPLAY_MODE,
    filter: DEFAULT_STREAM_VIEW_FILTER,
  };

  // Get sort preference for a stream (or global default if streamId is null)
  const getStreamSortPreference = useCallback((streamId: string | null): StreamSortPreference => {
    const key = streamId ?? '_global';
    const stored = settings.streamSortPreferences[key];
    return stored ?? defaultSortPreference;
  }, [settings.streamSortPreferences]);

  // Set sort preference for a stream (or global if streamId is null)
  const setStreamSortPreference = useCallback((streamId: string | null, pref: Partial<StreamSortPreference>) => {
    const key = streamId ?? '_global';
    setSettings(prev => ({
      ...prev,
      streamSortPreferences: {
        ...prev.streamSortPreferences,
        [key]: {
          ...defaultSortPreference,
          ...prev.streamSortPreferences[key],
          ...pref,
        },
      },
    }));
  }, []);

  // Get filter for a stream (convenience wrapper)
  const getStreamFilter = useCallback((streamId: string | null): StreamViewFilter => {
    const pref = getStreamSortPreference(streamId);
    return pref.filter ?? DEFAULT_STREAM_VIEW_FILTER;
  }, [getStreamSortPreference]);

  // Set filter for a stream (convenience wrapper)
  const setStreamFilter = useCallback((streamId: string | null, filter: Partial<StreamViewFilter>) => {
    const currentPref = getStreamSortPreference(streamId);
    const currentFilter = currentPref.filter ?? DEFAULT_STREAM_VIEW_FILTER;
    setStreamSortPreference(streamId, {
      filter: { ...currentFilter, ...filter },
    });
  }, [getStreamSortPreference, setStreamSortPreference]);

  // Reset filter for a stream to defaults
  const resetStreamFilter = useCallback((streamId: string | null) => {
    setStreamSortPreference(streamId, {
      filter: DEFAULT_STREAM_VIEW_FILTER,
    });
  }, [setStreamSortPreference]);

  const value: SettingsContextValue = {
    settings,
    updateSettings,
    resetSettings,
    isLoaded,
    getStreamSortPreference,
    setStreamSortPreference,
    getStreamFilter,
    setStreamFilter,
    resetStreamFilter,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
