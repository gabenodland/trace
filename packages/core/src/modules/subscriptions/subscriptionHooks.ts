/**
 * Subscription Hooks
 *
 * React hooks for checking features and subscription status.
 * These hooks integrate with the auth context to get the user's profile.
 */

import { useMemo } from 'react';
import {
  hasFeature,
  getFeatureLimit,
  isLimitReached,
  getEffectiveTier,
  type SubscriptionTier,
  type BooleanFeature,
  type LimitFeature,
} from '../../shared/featureGates';
import type { SubscriptionInfo, SubscriptionStatus } from './SubscriptionTypes';

// ============================================================================
// SUBSCRIPTION STATUS HOOK
// ============================================================================

/**
 * Get the current subscription status from profile data
 * This is a pure function that can be used with profile from any source
 */
export function getSubscriptionStatus(profile: SubscriptionInfo | null): SubscriptionStatus {
  if (!profile) {
    return {
      tier: 'free',
      isActive: false,
      isExpired: false,
      isTrial: false,
      expiresAt: null,
      platform: null,
      productId: null,
      isDevMode: false,
    };
  }

  const tier = profile.subscription_tier as SubscriptionTier || 'free';
  const expiresAt = profile.subscription_expires_at
    ? new Date(profile.subscription_expires_at)
    : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  const effectiveTier = getEffectiveTier(
    tier,
    profile.subscription_expires_at,
    profile.is_dev_mode
  );

  return {
    tier: effectiveTier,
    isActive: effectiveTier === 'pro',
    isExpired,
    isTrial: false, // TODO: Add trial tracking if needed
    expiresAt,
    platform: profile.subscription_platform,
    productId: profile.subscription_product_id,
    isDevMode: profile.is_dev_mode,
  };
}

/**
 * Hook to get subscription status
 * Pass the profile from useAuth() or similar
 */
export function useSubscriptionStatus(profile: SubscriptionInfo | null): SubscriptionStatus {
  return useMemo(() => getSubscriptionStatus(profile), [profile]);
}

// ============================================================================
// FEATURE CHECK HOOKS
// ============================================================================

/**
 * Check if a boolean feature is available
 * Returns true if the user's effective tier has access to the feature
 */
export function useFeature(
  feature: BooleanFeature,
  profile: SubscriptionInfo | null
): boolean {
  return useMemo(() => {
    const status = getSubscriptionStatus(profile);
    return hasFeature(feature, status.tier);
  }, [feature, profile]);
}

/**
 * Get the numeric limit for a feature
 * Returns the limit based on the user's effective tier
 */
export function useFeatureLimit(
  feature: LimitFeature,
  profile: SubscriptionInfo | null
): number {
  return useMemo(() => {
    const status = getSubscriptionStatus(profile);
    return getFeatureLimit(feature, status.tier);
  }, [feature, profile]);
}

/**
 * Check if a numeric limit has been reached
 */
export function useIsLimitReached(
  feature: LimitFeature,
  currentValue: number,
  profile: SubscriptionInfo | null
): boolean {
  return useMemo(() => {
    const status = getSubscriptionStatus(profile);
    return isLimitReached(feature, status.tier, currentValue);
  }, [feature, currentValue, profile]);
}

/**
 * Check if user is in dev mode
 */
export function useIsDevMode(profile: SubscriptionInfo | null): boolean {
  return profile?.is_dev_mode ?? false;
}

// ============================================================================
// FEATURE GATE COMPONENT HELPERS
// ============================================================================

/**
 * Props for feature-gated components
 */
export interface FeatureGateResult {
  hasAccess: boolean;
  tier: SubscriptionTier;
  isDevMode: boolean;
}

/**
 * Get feature gate info for conditional rendering
 */
export function useFeatureGate(
  feature: BooleanFeature,
  profile: SubscriptionInfo | null
): FeatureGateResult {
  return useMemo(() => {
    const status = getSubscriptionStatus(profile);
    return {
      hasAccess: hasFeature(feature, status.tier),
      tier: status.tier,
      isDevMode: status.isDevMode,
    };
  }, [feature, profile]);
}
