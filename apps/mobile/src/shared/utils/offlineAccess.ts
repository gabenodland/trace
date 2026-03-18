import AsyncStorage from "@react-native-async-storage/async-storage";
import { createScopedLogger, LogScopes } from "./logger";

const log = createScopedLogger(LogScopes.Auth);

const OFFLINE_ACCESS_KEY = "trace-offline-accounts";

export interface OfflineAccountRecord {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  savedAt: number;
}

type OfflineAccountStore = Record<string, OfflineAccountRecord>;

async function readStore(): Promise<OfflineAccountStore> {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_ACCESS_KEY);
    if (!data) return {};
    return JSON.parse(data) as OfflineAccountStore;
  } catch {
    return {};
  }
}

async function writeStore(store: OfflineAccountStore): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_ACCESS_KEY, JSON.stringify(store));
}

export async function saveOfflineAccount(record: Omit<OfflineAccountRecord, "savedAt">): Promise<void> {
  try {
    const store = await readStore();
    store[record.userId] = { ...record, savedAt: Date.now() };
    await writeStore(store);
    log.debug("Offline account saved", { userId: record.userId });
  } catch (error) {
    log.error("Failed to save offline account", error);
  }
}

export async function removeOfflineAccount(userId: string): Promise<void> {
  try {
    const store = await readStore();
    delete store[userId];
    await writeStore(store);
    log.debug("Offline account removed", { userId });
  } catch (error) {
    log.error("Failed to remove offline account", error);
  }
}

export async function getOfflineAccounts(): Promise<OfflineAccountRecord[]> {
  const store = await readStore();
  return Object.values(store).sort((a, b) => b.savedAt - a.savedAt);
}

export async function getOfflineAccount(userId: string): Promise<OfflineAccountRecord | null> {
  const store = await readStore();
  return store[userId] ?? null;
}

export async function hasOfflineAccount(userId: string): Promise<boolean> {
  const store = await readStore();
  return userId in store;
}
