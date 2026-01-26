/**
 * Subscription Types
 *
 * TypeScript types for subscription management.
 */

import type { Database } from '../../shared/database.types';

// Re-export from feature gates for convenience
export type {
  SubscriptionTier,
  SubscriptionPlatform,
  BooleanFeature,
  LimitFeature,
} from '../../shared/featureGates';

// Profile subscription fields (subset of full profile)
export interface SubscriptionInfo {
  subscription_tier: string;
  subscription_expires_at: string | null;
  subscription_platform: string | null;
  subscription_product_id: string | null;
  is_dev_mode: boolean;
}

// Full subscription receipt from database
export type SubscriptionReceipt = Database['public']['Tables']['subscription_receipts']['Row'];
export type SubscriptionReceiptInsert = Database['public']['Tables']['subscription_receipts']['Insert'];

// Subscription status for UI display
export interface SubscriptionStatus {
  tier: 'free' | 'pro';
  isActive: boolean;
  isExpired: boolean;
  isTrial: boolean;
  expiresAt: Date | null;
  platform: string | null;
  productId: string | null;
  isDevMode: boolean;
}

// Product info for purchase UI
export interface SubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAmount: number;
  currency: string;
  period: 'monthly' | 'yearly' | 'lifetime';
}

// Purchase result
export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}
