/**
 * Snackbar - Toast notification component
 *
 * Displays a temporary message at the top of the screen.
 * Shows for 2.5 seconds then fades out over 300ms.
 *
 * Usage:
 *   const { message, opacity, showSnackbar } = useSnackbar();
 *   <Snackbar message={message} opacity={opacity} />
 */

import { useRef, useCallback, useState } from 'react';
import { Animated, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface SnackbarProps {
  /** Message to display (null = hidden) */
  message: string | null;
  /** Animated opacity value */
  opacity: Animated.Value;
}

/**
 * Snackbar display component
 */
export function Snackbar({ message, opacity }: SnackbarProps) {
  const theme = useTheme();

  if (!message) return null;

  return (
    <Animated.View style={[styles.snackbar, { opacity }]}>
      <Text style={[styles.snackbarText, { fontFamily: theme.typography.fontFamily.medium }]}>
        {message}
      </Text>
    </Animated.View>
  );
}

/**
 * Hook for snackbar state management
 *
 * Returns:
 * - message: current message (or null)
 * - opacity: animated opacity value for Snackbar component
 * - showSnackbar: function to show a message
 */
export function useSnackbar() {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const showSnackbar = useCallback((text: string) => {
    setMessage(text);
    opacity.setValue(1);

    Animated.sequence([
      Animated.delay(2500),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMessage(null);
    });
  }, [opacity]);

  return {
    message,
    opacity,
    showSnackbar,
  };
}

const styles = StyleSheet.create({
  snackbar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 5,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    maxWidth: '70%',
    zIndex: 9999,
  },
  snackbarText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
});
