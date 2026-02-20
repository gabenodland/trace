/**
 * CreateApiKeyModal - Modal for creating new API keys
 *
 * Two-step flow:
 * 1. Input form: Name + Scope selection
 * 2. Success state: Show full key ONCE with copy button and warning
 *
 * The full API key is only shown once - it cannot be retrieved later!
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { Icon } from '../../../shared/components';
import { PickerBottomSheet } from '../../../components/sheets/PickerBottomSheet';
import { useApiKeys, ApiKeyScope } from '../hooks/useApiKeys';

interface CreateApiKeyModalProps {
  visible: boolean;
  onClose: () => void;
}

type ModalStep = 'form' | 'success';

export function CreateApiKeyModal({ visible, onClose }: CreateApiKeyModalProps) {
  const theme = useTheme();
  const { apiKeyMutations } = useApiKeys();

  // Form state
  const [step, setStep] = useState<ModalStep>('form');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiKeyScope>('read');
  const [isCreating, setIsCreating] = useState(false);

  // Success state
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  // Reset modal state
  const resetModal = useCallback(() => {
    setStep('form');
    setName('');
    setScope('read');
    setCreatedKey(null);
    setHasCopied(false);
    setIsCreating(false);
  }, []);

  // Handle close
  const handleClose = () => {
    if (step === 'success' && !hasCopied) {
      Alert.alert(
        'Key Not Copied',
        'You haven\'t copied your API key yet. This key will not be shown again. Are you sure you want to close?',
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'Close Anyway',
            style: 'destructive',
            onPress: () => {
              resetModal();
              onClose();
            },
          },
        ]
      );
    } else {
      resetModal();
      onClose();
    }
  };

  // Handle create
  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your API key.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await apiKeyMutations.createApiKey({
        name: name.trim(),
        scope,
      });
      setCreatedKey(result.fullKey);
      setStep('success');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Alert.alert(
        'Error',
        `Failed to create API key: ${errorMsg}`
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Handle copy
  const handleCopy = async () => {
    if (createdKey) {
      await Clipboard.setStringAsync(createdKey);
      setHasCopied(true);
    }
  };

  // Scope options
  const scopeOptions: { value: ApiKeyScope; label: string; description: string; icon: string }[] = [
    {
      value: 'read',
      label: 'Read Only',
      description: 'Can read entries and data but cannot create or modify anything',
      icon: 'Eye',
    },
    {
      value: 'full',
      label: 'Full Access',
      description: 'Can read, create, update, and delete entries and data',
      icon: 'Edit3',
    },
  ];

  const isFormValid = name.trim().length > 0;

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={handleClose}
      title={step === 'form' ? 'Create API Key' : 'API Key Created'}
      height="full"
      swipeArea="grabber"
      dismissKeyboard={false}
    >
      {step === 'form' ? (
          /* Form Step */
          <ScrollView
            style={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Name input */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                Name
              </Text>
              <Text style={[styles.hint, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                A descriptive name to identify this key
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.background.primary,
                    color: theme.colors.text.primary,
                    borderColor: theme.colors.border.light,
                    fontFamily: theme.typography.fontFamily.regular,
                  },
                ]}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Claude Desktop, Mobile App"
                placeholderTextColor={theme.colors.text.tertiary}
                maxLength={100}
                returnKeyType="done"
              />
            </View>

            {/* Scope selection */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                Permissions
              </Text>
              <Text style={[styles.hint, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                Choose the level of access for this key
              </Text>
              <View style={styles.scopeOptions}>
                {scopeOptions.map((option) => {
                  const isSelected = scope === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.scopeOption,
                        { backgroundColor: theme.colors.background.primary, borderColor: theme.colors.border.light },
                        isSelected && { borderColor: theme.colors.functional.accent, backgroundColor: theme.colors.functional.accentLight },
                      ]}
                      onPress={() => setScope(option.value)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.scopeIconContainer,
                        { backgroundColor: isSelected ? theme.colors.functional.accent + '20' : theme.colors.background.tertiary },
                      ]}>
                        <Icon
                          name={option.icon as any}
                          size={20}
                          color={isSelected ? theme.colors.functional.accent : theme.colors.text.secondary}
                        />
                      </View>
                      <View style={styles.scopeContent}>
                        <Text style={[
                          styles.scopeLabel,
                          { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
                          isSelected && { color: theme.colors.functional.accent },
                        ]}>
                          {option.label}
                        </Text>
                        <Text style={[styles.scopeDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                          {option.description}
                        </Text>
                      </View>
                      {isSelected && (
                        <Icon name="Check" size={20} color={theme.colors.functional.accent} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Create button */}
            <TouchableOpacity
              style={[
                styles.createButton,
                { backgroundColor: theme.colors.functional.accent },
                !isFormValid && { opacity: 0.5 },
              ]}
              onPress={handleCreate}
              disabled={!isFormValid || isCreating}
              activeOpacity={0.8}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Icon name="Plus" size={20} color="#ffffff" />
                  <Text style={[styles.createButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>
                    Create API Key
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          /* Success Step */
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* Success icon */}
            <View style={[styles.successIcon, { backgroundColor: theme.colors.functional.complete + '20' }]}>
              <Icon name="CheckCircle" size={48} color={theme.colors.functional.complete} />
            </View>

            <Text style={[styles.successTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
              API Key Created Successfully
            </Text>

            {/* Warning banner */}
            <View style={[styles.warningBanner, { backgroundColor: theme.colors.functional.overdue + '15' }]}>
              <Icon name="AlertTriangle" size={20} color={theme.colors.functional.overdue} />
              <Text style={[styles.warningText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>
                Copy this key now! It will not be shown again.
              </Text>
            </View>

            {/* Key display */}
            <View style={styles.keyContainer}>
              <Text style={[styles.keyLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
                Your API Key
              </Text>
              <View style={[styles.keyBox, { backgroundColor: theme.colors.background.primary, borderColor: theme.colors.border.light }]}>
                <Text
                  style={[styles.keyText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}
                  selectable
                >
                  {createdKey}
                </Text>
              </View>
            </View>

            {/* Copy button */}
            <TouchableOpacity
              style={[
                styles.copyButton,
                { backgroundColor: hasCopied ? theme.colors.functional.complete : theme.colors.functional.accent },
              ]}
              onPress={handleCopy}
              activeOpacity={0.8}
            >
              <Icon name={hasCopied ? 'Check' : 'Copy'} size={20} color="#ffffff" />
              <Text style={[styles.copyButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>
                {hasCopied ? 'Copied to Clipboard' : 'Copy to Clipboard'}
              </Text>
            </TouchableOpacity>

            {/* Done button */}
            <TouchableOpacity
              style={[styles.doneButton, { borderColor: theme.colors.border.dark }]}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.doneButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                Done
              </Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    marginBottom: 4,
  },
  hint: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  scopeOptions: {
    gap: 12,
  },
  scopeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  scopeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scopeContent: {
    flex: 1,
    marginRight: 12,
  },
  scopeLabel: {
    fontSize: 16,
    marginBottom: 2,
  },
  scopeDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 8,
    marginTop: 'auto',
  },
  createButtonText: {
    fontSize: 16,
    color: '#ffffff',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  successTitle: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  keyContainer: {
    marginBottom: 24,
  },
  keyLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  keyBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  keyText: {
    fontSize: 14,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  copyButtonText: {
    fontSize: 16,
    color: '#ffffff',
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
  },
  doneButtonText: {
    fontSize: 16,
  },
});
