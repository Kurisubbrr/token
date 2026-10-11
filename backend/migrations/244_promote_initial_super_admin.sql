-- Preserve existing installations and grant the initial active administrator
-- the owner role once. A new installation receives this role during setup.
UPDATE users
SET role = 'super_admin', updated_at = NOW()
WHERE id = (
    SELECT id
    FROM users
    WHERE role = 'admin' AND status = 'active' AND deleted_at IS NULL
    ORDER BY id ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM users WHERE role = 'super_admin' AND deleted_at IS NULL
);
