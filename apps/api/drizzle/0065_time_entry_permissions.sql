-- Upgrade editable default team roles without granting time writes to custom
-- client roles or overwriting explicitly configured time-entry permissions.
UPDATE workspace_role
SET permission = jsonb_set(permission::jsonb, '{timeEntry}', '["create","update"]'::jsonb)::text,
    updated_at = timezone('UTC', now())
WHERE role IN ('member', 'admin')
  AND NOT (permission::jsonb ? 'timeEntry')
  AND (permission::jsonb->'task') ? 'update';
