-- Phone identifiers are not verified: password registration does not assert ownership.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(11) NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
    ON users (phone) WHERE deleted_at IS NULL AND phone <> '';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_signup_source_check;
ALTER TABLE users ADD CONSTRAINT users_signup_source_check
    CHECK (signup_source IN ('email', 'phone', 'linuxdo', 'wechat', 'oidc', 'github', 'google', 'dingtalk'));
