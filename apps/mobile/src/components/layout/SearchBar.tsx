import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRef, useEffect } from 'react';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { Icon } from '../../shared/components';
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
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  const handleClearOrClose = () => {
    if (value.length > 0) {
      onChangeText('');
      inputRef.current?.focus();
    } else {
      onClose();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <View style={[styles.searchBox, { backgroundColor: theme.colors.background.tertiary }]}>
        <Icon name="Search" size={16} color={theme.colors.text.tertiary} />
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
        <TouchableOpacity style={styles.closeButton} onPress={handleClearOrClose}>
          <Icon name="X" size={16} color={theme.colors.text.tertiary} />
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
    height: 36,
    gap: themeBase.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: themeBase.typography.fontSize.base,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  closeButton: {
    padding: 14,
    marginRight: -8,
  },
});
