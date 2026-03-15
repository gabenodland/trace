/**
 * DevicesScreen — Connected Devices
 *
 * Shows all devices registered to the user's account.
 * Current device is highlighted. Other devices can be removed.
 * Accessible from Account > MANAGE > Devices.
 */

import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl, TextInput, Platform, InteractionManager } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Icon } from '../shared/components';
import { useTheme } from '../shared/contexts/ThemeContext';
import { themeBase } from '../shared/theme/themeBase';
import { createScopedLogger, LogScopes } from '../shared/utils/logger';

const log = createScopedLogger(LogScopes.Devices);
import { SecondaryHeader } from '../components/layout/SecondaryHeader';
import { useDevices, useDeactivateDevice, useReactivateDevice, useRemoveDevice, useUpdateDeviceName } from '../modules/devices';
import { getDeviceId } from '../config/appVersionService';
import type { Device } from '../modules/devices';
import type { IconName } from '../shared/components/Icon';

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getPlatformIcon(platform: string): IconName {
  return platform === 'web' ? 'Globe' : 'Smartphone';
}

function getDeviceSubtitle(device: Device): string {
  const platformName = device.platform === 'ios' ? 'iOS' : device.platform === 'android' ? 'Android' : 'Web';
  const model = device.device_model ? ` · ${device.device_model}` : '';
  return `${platformName}${model}`;
}

function getDisplayName(device: Device): string {
  return device.custom_name || device.device_name || 'Unknown Device';
}

export function DevicesScreen() {
  const theme = useTheme();
  const { data: devices, isLoading, error, refetch } = useDevices();
  const deactivateDevice = useDeactivateDevice();
  const reactivateDevice = useReactivateDevice();
  const removeDevice = useRemoveDevice();
  const updateDeviceName = useUpdateDeviceName();
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    getDeviceId().then(setLocalDeviceId).catch(err => log.warn('Failed to get device ID', { error: err }));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleRename = useCallback((device: Device) => {
    setEditName(device.custom_name || device.device_name || '');
    setIsEditing(true);
    InteractionManager.runAfterInteractions(() => inputRef.current?.focus());
  }, []);

  const handleSaveName = useCallback((device: Device) => {
    const trimmed = editName.trim();
    const newCustomName = (!trimmed || trimmed === device.device_name) ? null : trimmed;
    updateDeviceName.mutate(
      { deviceId: device.device_id, customName: newCustomName },
      {
        onSuccess: () => setIsEditing(false),
        onError: () => Alert.alert('Error', 'Failed to update device name.'),
      }
    );
  }, [editName, updateDeviceName]);

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName('');
  };

  const requireOnline = async (): Promise<boolean> => {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('Offline', 'You need to be online to manage devices.');
      return false;
    }
    return true;
  };

  const handleDeactivate = async (device: Device) => {
    if (!(await requireOnline())) return;
    const name = getDisplayName(device);
    Alert.alert(
      `Sign out ${name}?`,
      'This device will be signed out remotely and must sign in again to reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => deactivateDevice.mutate(device.device_id, {
            onError: () => Alert.alert('Error', 'Failed to deactivate device.'),
          }),
        },
      ]
    );
  };

  const handleReactivate = async (device: Device) => {
    if (!(await requireOnline())) return;
    reactivateDevice.mutate(device.device_id, {
      onError: () => Alert.alert('Error', 'Failed to reactivate device.'),
    });
  };

  const handleDelete = async (device: Device) => {
    if (!(await requireOnline())) return;
    const name = getDisplayName(device);
    Alert.alert(
      `Delete ${name}?`,
      'This will permanently remove the device record. Version history will show "Unknown device" for entries edited on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removeDevice.mutate(device.device_id, {
            onError: () => Alert.alert('Error', 'Failed to delete device.'),
          }),
        },
      ]
    );
  };

  const currentDevice = devices?.find(d => d.device_id === localDeviceId);
  const activeDevices = devices?.filter(d => d.device_id !== localDeviceId && d.is_active) || [];
  const deactivatedDevices = devices?.filter(d => d.device_id !== localDeviceId && !d.is_active) || [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Devices" />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading && !devices ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.text.tertiary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={[styles.emptyText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              Failed to load devices.
            </Text>
          </View>
        ) : (
          <>
            {/* Current Device */}
            {currentDevice && (
              <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
                <View style={styles.deviceRow}>
                  <View style={[styles.iconContainer, { backgroundColor: theme.colors.functional.accent + '20' }]}>
                    <Icon name={getPlatformIcon(currentDevice.platform)} size={22} color={theme.colors.functional.accent} />
                  </View>
                  <View style={styles.deviceInfo}>
                    {isEditing ? (
                      <View style={styles.editRow}>
                        <TextInput
                          ref={inputRef}
                          style={[styles.editInput, {
                            color: theme.colors.text.primary,
                            fontFamily: theme.typography.fontFamily.semibold,
                            borderColor: theme.colors.functional.accent,
                          }]}
                          value={editName}
                          onChangeText={setEditName}
                          onSubmitEditing={() => handleSaveName(currentDevice)}
                          returnKeyType="done"
                          maxLength={50}
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          onPress={() => handleSaveName(currentDevice)}
                          style={styles.editAction}
                          disabled={updateDeviceName.isPending}
                          accessibilityLabel="Save name"
                        >
                          <Icon name="Check" size={18} color={theme.colors.functional.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleCancelEdit}
                          style={styles.editAction}
                          disabled={updateDeviceName.isPending}
                          accessibilityLabel="Cancel editing"
                        >
                          <Icon name="X" size={18} color={theme.colors.text.tertiary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.nameRow}>
                        <Text style={[styles.deviceName, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold, flex: 1 }]} numberOfLines={1}>
                          {getDisplayName(currentDevice)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRename(currentDevice)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={styles.pencilButton}
                          accessibilityLabel="Rename device"
                        >
                          <Icon name="Pencil" size={15} color={theme.colors.text.tertiary} />
                        </TouchableOpacity>
                      </View>
                    )}
                    <Text style={[styles.deviceDetail, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                      {getDeviceSubtitle(currentDevice)}
                    </Text>
                    <Text style={[styles.deviceDetail, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                      v{currentDevice.app_version} · This device
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Active Devices */}
            {activeDevices.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
                  OTHER DEVICES
                </Text>
                <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
                  {activeDevices.map((device, index) => (
                    <View key={device.device_id}>
                      {index > 0 && (
                        <View style={[styles.rowDivider, { backgroundColor: theme.colors.border.light }]} />
                      )}
                      <View style={styles.deviceRow}>
                        <View style={[styles.iconContainer, { backgroundColor: theme.colors.background.tertiary }]}>
                          <Icon name={getPlatformIcon(device.platform)} size={22} color={theme.colors.text.secondary} />
                        </View>
                        <View style={styles.deviceInfo}>
                          <Text style={[styles.deviceName, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]} numberOfLines={1}>
                            {getDisplayName(device)}
                          </Text>
                          <Text style={[styles.deviceDetail, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                            {getDeviceSubtitle(device)}
                          </Text>
                          <Text style={[styles.deviceDetail, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                            v{device.app_version} · Last seen {formatRelativeTime(device.last_seen_at)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeactivate(device)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={styles.actionButton}
                          disabled={deactivateDevice.isPending}
                          accessibilityLabel={`Sign out ${getDisplayName(device)}`}
                        >
                          <Icon name="Power" size={18} color={theme.colors.text.tertiary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Deactivated Devices */}
            {deactivatedDevices.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
                  DEACTIVATED
                </Text>
                <View style={[styles.card, { backgroundColor: theme.colors.background.primary, opacity: 0.7 }, theme.shadows.sm]}>
                  {deactivatedDevices.map((device, index) => (
                    <View key={device.device_id}>
                      {index > 0 && (
                        <View style={[styles.rowDivider, { backgroundColor: theme.colors.border.light }]} />
                      )}
                      <View style={styles.deviceRow}>
                        <View style={[styles.iconContainer, { backgroundColor: theme.colors.background.tertiary }]}>
                          <Icon name={getPlatformIcon(device.platform)} size={22} color={theme.colors.text.tertiary} />
                        </View>
                        <View style={styles.deviceInfo}>
                          <Text style={[styles.deviceName, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]} numberOfLines={1}>
                            {getDisplayName(device)}
                          </Text>
                          <Text style={[styles.deviceDetail, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                            {getDeviceSubtitle(device)}
                          </Text>
                          <Text style={[styles.deviceDetail, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                            Signed out · Last seen {formatRelativeTime(device.last_seen_at)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleReactivate(device)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={styles.actionButton}
                          disabled={reactivateDevice.isPending}
                          accessibilityLabel={`Reactivate ${getDisplayName(device)}`}
                        >
                          <Icon name="RotateCcw" size={16} color={theme.colors.text.tertiary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(device)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={styles.actionButton}
                          disabled={removeDevice.isPending}
                          accessibilityLabel={`Delete ${getDisplayName(device)}`}
                        >
                          <Icon name="Trash2" size={16} color={theme.colors.text.tertiary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Empty state — no devices at all */}
            {devices?.length === 0 && (
              <View style={styles.centered}>
                <Text style={[styles.emptyText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                  No devices registered yet.
                </Text>
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                Devices are registered automatically on first sign in.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: themeBase.spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
  },
  card: {
    borderRadius: 12,
    marginBottom: themeBase.spacing.lg,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: themeBase.spacing.sm,
    marginLeft: themeBase.spacing.xs,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceInfo: {
    flex: 1,
    marginLeft: themeBase.spacing.md,
  },
  deviceName: {
    fontSize: 16,
  },
  deviceDetail: {
    fontSize: 13,
    marginTop: 2,
  },
  actionButton: {
    padding: themeBase.spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pencilButton: {
    padding: 4,
    marginLeft: themeBase.spacing.xs,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    fontSize: 16,
    borderBottomWidth: 1.5,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    paddingHorizontal: 0,
  },
  editAction: {
    padding: themeBase.spacing.sm,
    marginLeft: themeBase.spacing.xs,
  },
  rowDivider: {
    height: 1,
    marginLeft: 72,
  },
  footer: {
    alignItems: 'center',
    marginTop: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
