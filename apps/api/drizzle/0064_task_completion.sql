ALTER TABLE "task" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
CREATE INDEX "task_project_completed_at_idx" ON "task" USING btree ("project_id","completed_at");
--> statement-breakpoint
-- Recover only completion events we actually know. Historical final tasks with
-- no such event keep an unknown date rather than borrowing their last edit time.
UPDATE task t SET completed_at = (
  SELECT max(a.created_at) FROM activity a
  WHERE a.task_id = t.id AND a.type = 'status_changed'
    AND EXISTS (SELECT 1 FROM "column" c WHERE c.project_id = t.project_id
      AND c.slug = a.event_data->>'newStatus' AND c.is_final)
    AND NOT EXISTS (SELECT 1 FROM "column" c WHERE c.project_id = t.project_id
      AND c.slug = a.event_data->>'oldStatus' AND c.is_final)
)
WHERE EXISTS (SELECT 1 FROM "column" c WHERE c.project_id = t.project_id
  AND c.slug = t.status AND c.is_final);
--> statement-breakpoint
-- Cover every writer: board moves, bulk edits, CLI/MCP, imports and integrations.
CREATE FUNCTION track_task_completion() RETURNS trigger AS $$
DECLARE new_final boolean; old_final boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM "column" c WHERE c.project_id = NEW.project_id
    AND c.slug = NEW.status AND c.is_final) INTO new_final;
  IF NEW.status = 'archived' AND TG_OP = 'UPDATE' THEN
    NEW.completed_at := OLD.completed_at;
  ELSIF NOT new_final THEN
    NEW.completed_at := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NEW.created_at, (now() AT TIME ZONE 'utc'));
  ELSE
    SELECT EXISTS (SELECT 1 FROM "column" c WHERE c.project_id = OLD.project_id
      AND c.slug = OLD.status AND c.is_final) INTO old_final;
    IF old_final THEN
      NEW.completed_at := OLD.completed_at;
    ELSE
      NEW.completed_at := (now() AT TIME ZONE 'utc');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER task_completion BEFORE INSERT OR UPDATE OF status, project_id, column_id ON task
  FOR EACH ROW EXECUTE FUNCTION track_task_completion();
--> statement-breakpoint
CREATE FUNCTION track_column_completion() RETURNS trigger AS $$
BEGIN
  IF NEW.is_final IS DISTINCT FROM OLD.is_final THEN
    UPDATE task SET completed_at = CASE WHEN NEW.is_final
      THEN (now() AT TIME ZONE 'utc') ELSE NULL END
    WHERE project_id = NEW.project_id AND status = NEW.slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER column_completion AFTER UPDATE OF is_final ON "column"
  FOR EACH ROW EXECUTE FUNCTION track_column_completion();
