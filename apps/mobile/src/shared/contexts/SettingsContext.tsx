/**
 * Settings Context - Unified settings management with AsyncStorage persistence
 *
 * Provides settings throughout the app via React Context.
 * All settings are stored as a single JSON object for efficient persistence.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type UserSettings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  mergeWithDefaults,
} from '@trace/core';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface SettingsContextValue {
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
  resetSettings: () => void;
  isLoaded: boolean;
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

  // Save settings to AsyncStorage whenever they change (after initial load)
  useEffect(() => {
    if (!isLoaded) return;

    async function saveSettings() {
      try {
        await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        console.log('[SettingsContext] Saved settings');
      } catch (error) {
        console.error('[SettingsContext] Error saving settings:', error);
      }
    }

    saveSettings();
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

  const value: SettingsContextValue = {
    settings,
    updateSettings,
    resetSettings,
    isLoaded,
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
