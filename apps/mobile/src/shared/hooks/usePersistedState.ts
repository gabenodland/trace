/**
 * Hook for persisting state to AsyncStorage
 */
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createScopedLogger, LogScopes } from '../utils/logger';

const log = createScopedLogger(LogScopes.Cache);

export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    async function loadFromStorage() {
      try {
        const storedValue = await AsyncStorage.getItem(key);
        if (storedValue !== null) {
          setState(JSON.parse(storedValue));
        }
      } catch (error) {
        log.error(`Error loading ${key} from AsyncStorage`, error);
      } finally {
        setIsLoaded(true);
      }
    }

    loadFromStorage();
  }, [key]);

  // Save to AsyncStorage whenever state changes (but only after initial load)
  useEffect(() => {
    if (!isLoaded) return;

    async function saveToStorage() {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        log.error(`Error saving ${key} to AsyncStorage`, error);
      }
    }

    saveToStorage();
  }, [key, state, isLoaded]);

  return [state, setState];
}
