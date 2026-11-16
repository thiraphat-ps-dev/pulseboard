-- Opt-in email alerts, sent to the account's own email address
ALTER TABLE users ADD COLUMN email_alerts INTEGER NOT NULL DEFAULT 0;
