/**
 * Username Input Component
 *
 * Text input for username with:
 * - Client-side format validation
 * - Debounced server-side availability check
 * - Visual feedback (loading, available, taken)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { validateUsername } from '@trace/core';
import { theme } from '../../../shared/theme/theme';
import { createScopedLogger, LogScopes } from '../../../shared/utils/logger';

const log = createScopedLogger(LogScopes.Profile);

interface UsernameInputProps {
  /** Current username value */
  value: string;
  /** Called when username changes */
  onChangeText: (text: string) => void;
  /** Called to check username availability (should call server) */
  onCheckAvailability: (username: string) => Promise<boolean>;
  /** The user's current username (won't show as "taken") */
  currentUsername?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Called when input loses focus */
  onBlur?: () => void;
}

type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function UsernameInput({
  value,
  onChangeText,
  onCheckAvailability,
  currentUsername,
  disabled = false,
  error,
  onBlur,
}: UsernameInputProps) {
  const [status, setStatus] = useState<AvailabilityStatus>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckedRef = useRef<string>('');

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Check availability with debounce
  const checkAvailability = useCallback(async (username: string) => {
    // Skip if same as current username
    if (currentUsername && username.toLowerCase() === currentUsername.toLowerCase()) {
      setStatus('available');
      return;
    }

    // Skip if already checked
    if (lastCheckedRef.current === username) {
      return;
    }

    setStatus('checking');
    lastCheckedRef.current = username;

    try {
      const isAvailable = await onCheckAvailability(username);
      // Make sure we're still checking the same username
      if (lastCheckedRef.current === username) {
        setStatus(isAvailable ? 'available' : 'taken');
      }
    } catch (error) {
      log.error('Username availability check failed', error);
      // Don't show error state, just go back to idle
      if (lastCheckedRef.current === username) {
        setStatus('idle');
      }
    }
  }, [currentUsername, onCheckAvailability]);

  // Handle text changes
  const handleChangeText = useCallback((text: string) => {
    // Normalize: lowercase, trim
    const normalized = text.toLowerCase().trim();
    onChangeText(normalized);

    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Reset state
    setValidationError(null);
    lastCheckedRef.current = '';

    // Empty value
    if (!normalized) {
      setStatus('idle');
      return;
    }

    // Client-side validation first
    const validation = validateUsername(normalized);
    if (!validation.isValid) {
      setStatus('invalid');
      setValidationError(validation.error || 'Invalid username');
      return;
    }

    // Same as current username - no need to check
    if (currentUsername && normalized === currentUsername.toLowerCase()) {
      setStatus('available');
      return;
    }

    // Debounced server check
    setStatus('checking');
    debounceRef.current = setTimeout(() => {
      checkAvailability(normalized);
    }, 500); // 500ms debounce
  }, [currentUsername, onChangeText, checkAvailability]);

  // Determine display state
  const displayError = error || validationError;
  const showCheckmark = status === 'available' && !displayError;
  const showX = status === 'taken' && !displayError;
  const showSpinner = status === 'checking';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Username</Text>

      <View style={styles.inputContainer}>
        {/* @ prefix */}
        <Text style={styles.prefix}>@</Text>

        {/* Input */}
        <TextInput
          style={[
            styles.input,
            disabled && styles.inputDisabled,
            displayError && styles.inputError,
            showCheckmark && styles.inputValid,
          ]}
          value={value}
          onChangeText={handleChangeText}
          onBlur={onBlur}
          placeholder="username"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          editable={!disabled}
        />

        {/* Status indicator */}
        <View style={styles.statusContainer}>
          {showSpinner && (
            <ActivityIndicator size="small" color="#6b7280" />
          )}
          {showCheckmark && (
            <View style={styles.checkmark}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3}>
                <Path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          )}
          {showX && (
            <View style={styles.xMark}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={3}>
                <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          )}
        </View>
      </View>

      {/* Error/status message */}
      {displayError && (
        <Text style={styles.errorText}>{displayError}</Text>
      )}
      {status === 'taken' && !displayError && (
        <Text style={styles.errorText}>This username is already taken</Text>
      )}
      {status === 'available' && !displayError && value && (
        <Text style={styles.successText}>Username is available</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  prefix: {
    paddingLeft: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  input: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  inputValid: {
    borderColor: '#22c55e',
  },
  statusContainer: {
    paddingRight: theme.spacing.md,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xMark: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: theme.spacing.xs,
    fontSize: 12,
    color: '#ef4444',
  },
  successText: {
    marginTop: theme.spacing.xs,
    fontSize: 12,
    color: '#22c55e',
  },
});
