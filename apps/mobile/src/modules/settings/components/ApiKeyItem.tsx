/**
 * ApiKeyItem - Individual API key row component
 *
 * Shows:
 * - Key name
 * - Key prefix (tr_live_a1b2...)
 * - Scope badge (Read / Full Access)
 * - Last used time or "Never"
 * - Revoke button (with confirmation) for active keys
 * - Delete button for revoked keys
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { Icon } from '../../../shared/components';
import { useApiKeys, ApiKey } from '../hooks/useApiKeys';
import { formatDistanceToNow } from 'date-fns';

interface ApiKeyItemProps {
  apiKey: ApiKey;
  isLast?: boolean;
}

export function ApiKeyItem({ apiKey, isLast = false }: ApiKeyItemProps) {
  const theme = useTheme();
  const { apiKeyMutations } = useApiKeys();
  const [isActionPending, setIsActionPending] = useState(false);

  const isRevoked = !!apiKey.revoked_at;

  // Format last used time
  const lastUsedText = apiKey.last_used_at
    ? formatDistanceToNow(new Date(apiKey.last_used_at), { addSuffix: true })
    : 'Never used';

  // Format created time
  const createdText = formatDistanceToNow(new Date(apiKey.created_at), { addSuffix: true });

  // Handle revoke action
  const handleRevoke = () => {
    Alert.alert(
      'Revoke API Key',
      `Are you sure you want to revoke "${apiKey.name}"? This action cannot be undone. Any applications using this key will immediately lose access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setIsActionPending(true);
            try {
              await apiKeyMutations.revokeApiKey(apiKey.api_key_id);
            } catch (error) {
              Alert.alert('Error', 'Failed to revoke API key. Please try again.');
            } finally {
              setIsActionPending(false);
            }
          },
        },
      ]
    );
  };

  // Handle delete action
  const handleDelete = () => {
    Alert.alert(
      'Delete API Key',
      `Are you sure you want to permanently delete "${apiKey.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsActionPending(true);
            try {
              await apiKeyMutations.deleteApiKey(apiKey.api_key_id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete API key. Please try again.');
            } finally {
              setIsActionPending(false);
            }
          },
        },
      ]
    );
  };

  // Scope badge colors
  const scopeColors = {
    read: {
      bg: theme.colors.status.open + '20',
      text: theme.colors.status.open,
      label: 'Read Only',
    },
    full: {
      bg: theme.colors.functional.accent + '20',
      text: theme.colors.functional.accent,
      label: 'Full Access',
    },
  };
  const scopeStyle = scopeColors[apiKey.scope] || scopeColors.read;

  return (
    <View
      style={[
        styles.container,
        { borderBottomColor: theme.colors.border.light },
        isLast && styles.containerLast,
        isRevoked && styles.containerRevoked,
      ]}
    >
      {/* Main content */}
      <View style={styles.content}>
        {/* Name and badge row */}
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.name,
              { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium },
              isRevoked && { color: theme.colors.text.tertiary },
            ]}
            numberOfLines={1}
          >
            {apiKey.name}
          </Text>
          <View style={[styles.scopeBadge, { backgroundColor: scopeStyle.bg }]}>
            <Text style={[styles.scopeText, { color: scopeStyle.text, fontFamily: theme.typography.fontFamily.medium }]}>
              {scopeStyle.label}
            </Text>
          </View>
          {isRevoked && (
            <View style={[styles.revokedBadge, { backgroundColor: theme.colors.functional.overdue + '20' }]}>
              <Text style={[styles.revokedText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>
                Revoked
              </Text>
            </View>
          )}
        </View>

        {/* Key prefix */}
        <View style={styles.prefixRow}>
          <Icon name="Key" size={14} color={theme.colors.text.tertiary} />
          <Text
            style={[
              styles.prefix,
              { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
              isRevoked && { color: theme.colors.text.tertiary },
            ]}
          >
            {apiKey.key_prefix}...
          </Text>
        </View>

        {/* Metadata row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Icon name="Clock" size={12} color={theme.colors.text.tertiary} />
            <Text style={[styles.metaText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              {isRevoked ? `Revoked ${formatDistanceToNow(new Date(apiKey.revoked_at!), { addSuffix: true })}` : lastUsedText}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Icon name="Calendar" size={12} color={theme.colors.text.tertiary} />
            <Text style={[styles.metaText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              Created {createdText}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {isActionPending ? (
          <ActivityIndicator size="small" color={theme.colors.text.secondary} />
        ) : isRevoked ? (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.background.tertiary }]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Icon name="Trash2" size={16} color={theme.colors.functional.overdue} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.functional.overdue + '15' }]}
            onPress={handleRevoke}
            activeOpacity={0.7}
          >
            <Icon name="Ban" size={16} color={theme.colors.functional.overdue} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  containerLast: {
    borderBottomWidth: 0,
  },
  containerRevoked: {
    opacity: 0.7,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    flexShrink: 1,
  },
  scopeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scopeText: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  revokedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  revokedText: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prefixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  prefix: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  actions: {
    justifyContent: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
