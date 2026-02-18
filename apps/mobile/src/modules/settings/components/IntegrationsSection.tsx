/**
 * IntegrationsSection - Settings section for managing API keys and integrations
 *
 * Pro feature: Create/revoke keys gated behind apiAccess feature.
 * Free users can see existing keys (read-only) but cannot create or revoke.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { useSubscription } from '../../../shared/hooks/useSubscription';
import { useNavigate } from '../../../shared/navigation';
import { Icon } from '../../../shared/components';
import { useApiKeys } from '../hooks/useApiKeys';
import { ApiKeyItem } from './ApiKeyItem';
import { CreateApiKeyModal } from './CreateApiKeyModal';

const INTEGRATION_DOCS_URL = 'https://www.mindjig.com/trace/integrations';

export function IntegrationsSection() {
  const theme = useTheme();
  const { hasFeature } = useSubscription();
  const navigate = useNavigate();
  const { activeKeys, revokedKeys, isLoading, error, refetch } = useApiKeys();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRevokedKeys, setShowRevokedKeys] = useState(false);

  const canManageKeys = hasFeature('apiAccess');

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Icon name="Plug" size={20} color={theme.colors.text.secondary} style={styles.headerIcon} />
            <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
              Integrations
            </Text>
          </View>
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
          <View style={styles.headerLeft}>
            <Icon name="Plug" size={20} color={theme.colors.text.secondary} style={styles.headerIcon} />
            <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
              Integrations
            </Text>
          </View>
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
          <Icon name="Plug" size={20} color={theme.colors.text.secondary} style={styles.headerIcon} />
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
            Integrations
          </Text>
          {!canManageKeys && (
            <View style={[styles.proBadge, { backgroundColor: theme.colors.functional.accent + '20' }]}>
              <Icon name="Lock" size={12} color={theme.colors.functional.accent} />
              <Text style={[styles.proBadgeText, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold }]}>
                PRO
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.createButton,
            { backgroundColor: canManageKeys ? theme.colors.functional.accent : theme.colors.border.dark },
          ]}
          onPress={() => {
            if (canManageKeys) {
              setShowCreateModal(true);
            } else {
              navigate('subscription');
            }
          }}
          activeOpacity={0.8}
        >
          {canManageKeys && <Icon name="Plus" size={16} color="#ffffff" />}
          <Text style={[styles.createButtonText, { fontFamily: theme.typography.fontFamily.medium }]}>
            {canManageKeys ? 'Create' : 'Upgrade'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
        Connect external apps to your Trace data via API keys. Works with MCP-compatible AI assistants and custom integrations.
      </Text>

      {/* Setup Instructions link */}
      <TouchableOpacity
        style={[styles.docsLink, { borderColor: theme.colors.border.light }]}
        onPress={() => Linking.openURL(INTEGRATION_DOCS_URL)}
        activeOpacity={0.7}
      >
        <Icon name="ExternalLink" size={14} color={theme.colors.functional.accent} />
        <Text style={[styles.docsLinkText, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.medium }]}>
          Setup Instructions
        </Text>
      </TouchableOpacity>

      {/* Pro upgrade prompt for free users */}
      {!canManageKeys && !hasKeys && (
        <View style={[styles.upgradePrompt, { backgroundColor: theme.colors.functional.accent + '08', borderColor: theme.colors.functional.accent + '20' }]}>
          <Icon name="Sparkles" size={18} color={theme.colors.functional.accent} />
          <View style={styles.upgradeContent}>
            <Text style={[styles.upgradeTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
              Unlock Integrations
            </Text>
            <Text style={[styles.upgradeDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
              Upgrade to Pro to create API keys and connect external apps.
            </Text>
          </View>
        </View>
      )}

      {/* Empty state (only for Pro users with no keys) */}
      {canManageKeys && !hasKeys && (
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
              readOnly={!canManageKeys}
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
                  readOnly={!canManageKeys}
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
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  proBadgeText: {
    fontSize: 11,
    letterSpacing: 0.5,
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
    marginBottom: 12,
  },
  docsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  docsLinkText: {
    fontSize: 14,
  },
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  upgradeContent: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 15,
    marginBottom: 2,
  },
  upgradeDescription: {
    fontSize: 13,
    lineHeight: 18,
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
