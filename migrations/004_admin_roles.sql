ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Первый созданный админ становится главным (для существующих установок).
UPDATE admins
SET is_super_admin = TRUE
WHERE id = (SELECT id FROM admins ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM admins WHERE is_super_admin = TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_display_name_unique ON admins (display_name);
