import * as LocalAuthentication from "expo-local-authentication";
import { createScopedLogger, LogScopes } from "./logger";

const log = createScopedLogger(LogScopes.Auth);

export interface BiometricResult {
  success: boolean;
  error?: string;
}

/**
 * Check whether biometrics are available and enrolled on this device.
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch {
    return false;
  }
}

/**
 * Prompt the user for biometric authentication (Face ID, fingerprint, or device PIN fallback).
 * Returns success/failure without throwing.
 */
export async function authenticateWithBiometrics(promptMessage: string): Promise<BiometricResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
      cancelLabel: "Cancel",
    });

    if (result.success) {
      log.info("Biometric auth succeeded");
      return { success: true };
    }

    log.info("Biometric auth failed", { error: result.error });
    return { success: false, error: result.error };
  } catch (error) {
    log.error("Biometric auth error", error);
    return { success: false, error: "unknown" };
  }
}
