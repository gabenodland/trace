import { forwardRef, useRef, useImperativeHandle } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Icon } from './Icon';
import { themeBase } from '../theme/themeBase';

interface SearchInputProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const SearchInput = forwardRef<TextInput, SearchInputProps>(function SearchInput({
  value,
  onChangeText,
  placeholder = "Search...",
  containerStyle,
  ...rest
}, ref) {
  const theme = useTheme();
  const innerRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => innerRef.current!);

  const handleClear = () => {
    onChangeText('');
    innerRef.current?.focus();
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.tertiary },
        containerStyle,
      ]}
    >
      <Icon name="Search" size={16} color={theme.colors.text.tertiary} />
      <TextInput
        ref={innerRef}
        style={[
          styles.input,
          {
            color: theme.colors.text.primary,
            fontFamily: theme.typography.fontFamily.regular,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.tertiary}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="X" size={16} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: themeBase.borderRadius.lg,
    paddingHorizontal: themeBase.spacing.md,
    height: 36,
    gap: themeBase.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
});
