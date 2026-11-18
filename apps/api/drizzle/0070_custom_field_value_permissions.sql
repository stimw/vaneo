-- Writing custom field values (such as a task's category) now needs
-- customFieldValue:write instead of task:update. Keep it for editable default
-- team roles; client and custom roles lose it until granted in Roles.
UPDATE workspace_role
SET permission = jsonb_set(permission::jsonb, '{customFieldValue}', '["write"]'::jsonb)::text,
    updated_at = timezone('UTC', now())
WHERE role IN ('member', 'admin')
  AND NOT (permission::jsonb ? 'customFieldValue')
  AND (permission::jsonb->'task') ? 'update';
