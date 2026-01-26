-- ============================================================================
-- Subscriptions Migration
-- ============================================================================
-- Adds subscription fields to profiles and creates receipt tracking table
-- Supports App Store and Play Store subscriptions with server-side validation

-- ============================================================================
-- Add Subscription Fields to Profiles
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_platform text,
  ADD COLUMN IF NOT EXISTS subscription_product_id text,
  ADD COLUMN IF NOT EXISTS is_dev_mode boolean NOT NULL DEFAULT false;

-- Constraints
ALTER TABLE profiles
  ADD CONSTRAINT profiles_subscription_tier_valid
    CHECK (subscription_tier IN ('free', 'pro'));

ALTER TABLE profiles
  ADD CONSTRAINT profiles_subscription_platform_valid
    CHECK (subscription_platform IS NULL OR subscription_platform IN ('ios', 'android', 'web', 'manual'));

-- Index for subscription queries (admin analytics)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_expires ON profiles(subscription_expires_at);

-- ============================================================================
-- Subscription Receipts Table
-- ============================================================================
-- Stores all receipt validations from App Store / Play Store
-- Used for audit trail, dispute resolution, and subscription history

CREATE TABLE IF NOT EXISTS subscription_receipts (
  receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Platform info
  platform text NOT NULL,                           -- 'ios', 'android'
  product_id text NOT NULL,                         -- e.g., 'com.trace.pro.monthly'

  -- Store transaction details
  store_transaction_id text NOT NULL,               -- App Store/Play Store transaction ID
  store_original_transaction_id text,               -- For renewals, links to original

  -- Subscription period
  purchase_date timestamptz NOT NULL,
  expires_date timestamptz,                         -- null for lifetime purchases

  -- Status
  is_trial boolean DEFAULT false,
  is_intro_offer boolean DEFAULT false,
  cancellation_date timestamptz,                    -- When user cancelled (still valid until expires)

  -- Raw receipt for verification
  receipt_data text,                                -- Base64 encoded receipt (encrypted at rest)
  validation_response jsonb,                        -- Store's validation response

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Prevent duplicate transactions
  CONSTRAINT subscription_receipts_unique_transaction
    UNIQUE (platform, store_transaction_id)
);

-- Constraints
ALTER TABLE subscription_receipts
  ADD CONSTRAINT subscription_receipts_platform_valid
    CHECK (platform IN ('ios', 'android'));

-- Indexes
CREATE INDEX idx_subscription_receipts_user ON subscription_receipts(user_id);
CREATE INDEX idx_subscription_receipts_expires ON subscription_receipts(expires_date);
CREATE INDEX idx_subscription_receipts_product ON subscription_receipts(product_id);
CREATE INDEX idx_subscription_receipts_store_txn ON subscription_receipts(store_transaction_id);

-- Updated at trigger
CREATE TRIGGER update_subscription_receipts_updated_at
  BEFORE UPDATE ON subscription_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE subscription_receipts ENABLE ROW LEVEL SECURITY;

-- Users can read their own receipts
CREATE POLICY "Users can read own receipts"
  ON subscription_receipts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service role can insert/update receipts (server-side validation)
-- Users cannot directly manipulate their subscription receipts
CREATE POLICY "Service role can manage receipts"
  ON subscription_receipts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN profiles.subscription_tier IS 'Current subscription tier: free, pro';
COMMENT ON COLUMN profiles.subscription_expires_at IS 'When subscription expires (null = lifetime or free)';
COMMENT ON COLUMN profiles.subscription_platform IS 'Platform where subscription was purchased: ios, android, web, manual';
COMMENT ON COLUMN profiles.subscription_product_id IS 'Store product ID of current subscription';
COMMENT ON COLUMN profiles.is_dev_mode IS 'Enables dev features and unlocks all Pro features for testing';

COMMENT ON TABLE subscription_receipts IS 'Audit trail of all subscription purchases and renewals from App Store/Play Store';
COMMENT ON COLUMN subscription_receipts.store_transaction_id IS 'Unique transaction ID from the app store';
COMMENT ON COLUMN subscription_receipts.store_original_transaction_id IS 'Links renewals to original purchase';
COMMENT ON COLUMN subscription_receipts.receipt_data IS 'Base64 encoded receipt for re-validation if needed';
COMMENT ON COLUMN subscription_receipts.validation_response IS 'Full response from store validation API';
