/**
 * Subscription Hook
 *
 * Simple wrapper for feature gating. Just import and use.
 *
 * @example
 * import { useSubscription } from '../shared/hooks/useSubscription';
 *
 * function ThemePicker() {
 *   const { hasFeature, getLimit, isPro, isDevMode } = useSubscription();
 *
 *   if (hasFeature('allThemes')) {
 *     // Show all themes
 *   }
 *
 *   const maxPhotos = getLimit('maxPhotosPerEntry');
 * }
 */

import { useMemo } from 'react';
import {
  hasFeature as checkFeature,
  getFeatureLimit,
  isLimitReached as checkLimitReached,
  getEffectiveTier,
  type BooleanFeature,
  type LimitFeature,
  type SubscriptionTier,
} from '@trace/core';
import { useMobileProfile } from './useMobileProfile';

export function useSubscription() {
  const { profile } = useMobileProfile();

  // Calculate effective tier once
  const tier: SubscriptionTier = useMemo(() => {
    if (!profile) return 'free';
    return getEffectiveTier(
      (profile.subscription_tier as SubscriptionTier) || 'free',
      profile.subscription_expires_at,
      profile.is_dev_mode
    );
  }, [profile]);

  const isDevMode = profile?.is_dev_mode ?? false;
  const isPro = tier === 'pro';

  return {
    /** Current effective tier ('free' or 'pro') */
    tier,

    /** True if user has Pro subscription (or dev mode) */
    isPro,

    /** True if user is in dev mode */
    isDevMode,

    /** Check if a boolean feature is available */
    hasFeature: (feature: BooleanFeature): boolean => {
      return checkFeature(feature, tier);
    },

    /** Get the numeric limit for a feature */
    getLimit: (feature: LimitFeature): number => {
      return getFeatureLimit(feature, tier);
    },

    /** Check if a limit has been reached */
    isLimitReached: (feature: LimitFeature, currentValue: number): boolean => {
      return checkLimitReached(feature, tier, currentValue);
    },

    /** Subscription expiration date (if any) */
    expiresAt: profile?.subscription_expires_at
      ? new Date(profile.subscription_expires_at)
      : null,

    /** Platform where subscription was purchased */
    platform: profile?.subscription_platform ?? null,
  };
}
