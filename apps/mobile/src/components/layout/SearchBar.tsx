import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { useRef, useEffect } from 'react';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { themeBase } from '../../shared/theme/themeBase';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  onClose,
  placeholder = "Search entries...",
  autoFocus = true,
}: SearchBarProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus) {
      // Small delay to ensure component is mounted
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  const handleClearOrClose = () => {
    if (value.length > 0) {
      // Clear the search text
      onChangeText('');
      inputRef.current?.focus();
    } else {
      // Close the search bar
      onClose();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <View style={[styles.searchBox, { backgroundColor: theme.colors.background.tertiary }]}>
        {/* Search Icon */}
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
          <Circle cx={11} cy={11} r={8} />
          <Line x1={21} y1={21} x2={16.65} y2={16.65} strokeLinecap="round" />
        </Svg>

        {/* Input */}
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.tertiary}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* X button - clears text if present, otherwise closes search */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClearOrClose}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
            <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
            <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: themeBase.spacing.lg,
    paddingVertical: themeBase.spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: themeBase.borderRadius.lg,
    paddingHorizontal: themeBase.spacing.md,
    paddingVertical: themeBase.spacing.sm,
    gap: themeBase.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: themeBase.typography.fontSize.base,
    padding: 0,
  },
  closeButton: {
    padding: 2,
  },
});
