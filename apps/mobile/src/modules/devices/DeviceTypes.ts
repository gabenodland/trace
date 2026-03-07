/**
 * Device type — matches `devices` table row (renamed from app_sessions)
 */
export interface Device {
  device_id: string;
  user_id: string;
  device_name: string | null;
  custom_name: string | null;
  device_model: string | null;
  platform: string;
  app_version: string;
  build_number: string | null;
  is_debug_build: boolean;
  os_version: string | null;
  is_active: boolean;
  first_seen_at: string;
  last_seen_at: string;
}
