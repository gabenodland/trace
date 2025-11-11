import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import type { EntryDisplayMode } from '../types/EntryDisplayMode';
import { ENTRY_DISPLAY_MODES } from '../types/EntryDisplayMode';
import Svg, { Path } from 'react-native-svg';

interface DisplayModeSelectorProps {
  visible: boolean;
  selectedMode: EntryDisplayMode;
  onSelect: (mode: EntryDisplayMode) => void;
  onClose: () => void;
}

export function DisplayModeSelector({
  visible,
  selectedMode,
  onSelect,
  onClose,
}: DisplayModeSelectorProps) {
  const handleSelect = (mode: EntryDisplayMode) => {
    onSelect(mode);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Display Mode</Text>
          </View>

          {ENTRY_DISPLAY_MODES.map((mode) => {
            const isSelected = mode.value === selectedMode;

            return (
              <TouchableOpacity
                key={mode.value}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => handleSelect(mode.value)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {mode.label}
                  </Text>
                  <Text style={styles.optionDescription}>{mode.description}</Text>
                </View>

                {isSelected && (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M5 13l4 4L19 7"
                      stroke="#2563eb"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionSelected: {
    backgroundColor: '#eff6ff',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: '#2563eb',
  },
  optionDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
});
