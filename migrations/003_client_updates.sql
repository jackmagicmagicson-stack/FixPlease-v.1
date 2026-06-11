ALTER TABLE app_settings
    ADD COLUMN client_update_version TEXT,
    ADD COLUMN client_update_url TEXT,
    ADD COLUMN client_update_signature TEXT;
