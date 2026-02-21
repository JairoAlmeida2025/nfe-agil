-- 1. Create trial_used column
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS trial_used boolean DEFAULT false;

-- 2. Create index on user_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- 3. Ensure stripe columns exist for future integration
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
