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
import { Animated, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();

  if (!message) return null;

  return (
    <Animated.View style={[styles.snackbar, { opacity, top: insets.top + 5 }]}>
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
