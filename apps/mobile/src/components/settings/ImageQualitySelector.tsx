/**
 * Image Quality Selector - Modal for choosing photo compression quality
 */

import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView, Platform, StatusBar } from 'react-native';
import { type ImageQuality, IMAGE_QUALITY_OPTIONS } from '@trace/core';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { Icon } from '../../shared/components';

interface ImageQualitySelectorProps {
  visible: boolean;
  selectedQuality: ImageQuality;
  onSelect: (quality: ImageQuality) => void;
  onClose: () => void;
}

export function ImageQualitySelector({
  visible,
  selectedQuality,
  onSelect,
  onClose,
}: ImageQualitySelectorProps) {
  const theme = useTheme();

  const handleSelect = (quality: ImageQuality) => {
    onSelect(quality);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>Photo Quality</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="X" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <View style={styles.optionsList}>
          {IMAGE_QUALITY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionItem,
                { backgroundColor: theme.colors.background.primary },
                selectedQuality === option.value && [styles.optionItemSelected, { borderColor: theme.colors.functional.accent, backgroundColor: theme.colors.functional.accentLight }],
              ]}
              onPress={() => handleSelect(option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionLabel,
                  { color: theme.colors.text.primary },
                  selectedQuality === option.value && { color: theme.colors.functional.accent },
                ]}>
                  {option.label}
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.text.secondary }]}>{option.description}</Text>
              </View>
              {selectedQuality === option.value && (
                <Icon name="Check" size={24} color={theme.colors.functional.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Info text */}
        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: theme.colors.text.tertiary }]}>
            Higher quality photos use more storage space. Full Quality preserves the original image from your camera.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 16,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    padding: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionItemSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionContent: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: '#2563eb',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoContainer: {
    paddingHorizontal: 20,
  },
  infoText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
});
