/**
 * ApiKeysSection - Settings section for managing API keys
 *
 * Shows:
 * - Header with "API Keys" title and "Create" button
 * - List of active API keys (ApiKeyItem components)
 * - List of revoked keys (collapsed by default)
 * - Empty state if no keys
 * - Loading state
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { Icon } from '../../../shared/components';
import { useApiKeys } from '../hooks/useApiKeys';
import { ApiKeyItem } from './ApiKeyItem';
import { CreateApiKeyModal } from './CreateApiKeyModal';

export function ApiKeysSection() {
  const theme = useTheme();
  const { activeKeys, revokedKeys, isLoading, error, refetch } = useApiKeys();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRevokedKeys, setShowRevokedKeys] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
        <View style={styles.headerRow}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
            API Keys
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.text.secondary} />
          <Text style={[styles.loadingText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
            Loading keys...
          </Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
        <View style={styles.headerRow}>
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
            API Keys
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Icon name="AlertCircle" size={24} color={theme.colors.functional.overdue} />
          <Text style={[styles.errorText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.regular }]}>
            Failed to load API keys
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.background.tertiary }]}
            onPress={() => refetch()}
            activeOpacity={0.7}
          >
            <Text style={[styles.retryButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasKeys = activeKeys.length > 0 || revokedKeys.length > 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon name="Key" size={20} color={theme.colors.text.secondary} style={styles.headerIcon} />
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
            API Keys
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.colors.functional.accent }]}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.8}
        >
          <Icon name="Plus" size={16} color="#ffffff" />
          <Text style={[styles.createButtonText, { fontFamily: theme.typography.fontFamily.medium }]}>
            Create
          </Text>
        </TouchableOpacity>
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
        API keys allow external applications to access your data programmatically.
      </Text>

      {/* Empty state */}
      {!hasKeys && (
        <View style={[styles.emptyState, { borderColor: theme.colors.border.light }]}>
          <Icon name="KeyRound" size={32} color={theme.colors.text.tertiary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
            No API Keys
          </Text>
          <Text style={[styles.emptyDescription, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            Create an API key to integrate with external apps and services.
          </Text>
        </View>
      )}

      {/* Active keys list */}
      {activeKeys.length > 0 && (
        <View style={styles.keysList}>
          {activeKeys.map((apiKey, index) => (
            <ApiKeyItem
              key={apiKey.api_key_id}
              apiKey={apiKey}
              isLast={index === activeKeys.length - 1 && revokedKeys.length === 0}
            />
          ))}
        </View>
      )}

      {/* Revoked keys section */}
      {revokedKeys.length > 0 && (
        <View style={styles.revokedSection}>
          <TouchableOpacity
            style={[styles.revokedHeader, { borderTopColor: theme.colors.border.light }]}
            onPress={() => setShowRevokedKeys(!showRevokedKeys)}
            activeOpacity={0.7}
          >
            <Text style={[styles.revokedTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
              Revoked Keys ({revokedKeys.length})
            </Text>
            <Icon
              name={showRevokedKeys ? 'ChevronUp' : 'ChevronDown'}
              size={16}
              color={theme.colors.text.tertiary}
            />
          </TouchableOpacity>

          {showRevokedKeys && (
            <View style={styles.keysList}>
              {revokedKeys.map((apiKey, index) => (
                <ApiKeyItem
                  key={apiKey.api_key_id}
                  apiKey={apiKey}
                  isLast={index === revokedKeys.length - 1}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Create Modal */}
      <CreateApiKeyModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 18,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  createButtonText: {
    fontSize: 14,
    color: '#ffffff',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  emptyTitle: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  keysList: {
    marginTop: 8,
  },
  revokedSection: {
    marginTop: 16,
  },
  revokedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  revokedTitle: {
    fontSize: 14,
  },
});
