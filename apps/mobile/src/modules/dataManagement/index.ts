// Public API for mobile dataManagement module

// Export hooks
export {
  useDeviceStorageUsage,
  useTopLevelCounts,
  useEntrySummary,
  useDeletedEntrySummary,
  useEntryList,
  usePrivacySummary,
  useLocalTrash,
  dataManagementKeys,
} from './mobileDataManagementHooks';

// DO NOT export API functions - they are internal only
