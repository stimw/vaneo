ALTER TABLE "task" ADD COLUMN "tracked_seconds" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Preserve the existing totals when switching the UI to one editable value.
UPDATE task t SET tracked_seconds = COALESCE((
  SELECT sum(GREATEST(0, floor(extract(epoch FROM (e.end_time - e.start_time)))))
  FROM time_entry e WHERE e.task_id = t.id AND e.end_time IS NOT NULL
), 0)::bigint;
--> statement-breakpoint
-- Legacy CLI/MCP entries remain usable. Apply only their duration difference,
-- so a manually corrected task total is not replaced by the old entry sum.
CREATE FUNCTION sync_task_time_total() RETURNS trigger AS $$
DECLARE old_seconds bigint := 0; new_seconds bigint := 0;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.end_time IS NOT NULL THEN
    old_seconds := GREATEST(0, floor(extract(epoch FROM (OLD.end_time - OLD.start_time))))::bigint;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.end_time IS NOT NULL THEN
    new_seconds := GREATEST(0, floor(extract(epoch FROM (NEW.end_time - NEW.start_time))))::bigint;
  END IF;
  IF TG_OP = 'INSERT' THEN
    UPDATE task SET tracked_seconds = tracked_seconds + new_seconds WHERE id = NEW.task_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE task SET tracked_seconds = GREATEST(0, tracked_seconds - old_seconds) WHERE id = OLD.task_id;
  ELSIF OLD.task_id = NEW.task_id THEN
    UPDATE task SET tracked_seconds = GREATEST(0, tracked_seconds + new_seconds - old_seconds) WHERE id = NEW.task_id;
  ELSE
    UPDATE task SET tracked_seconds = GREATEST(0, tracked_seconds - old_seconds) WHERE id = OLD.task_id;
    UPDATE task SET tracked_seconds = tracked_seconds + new_seconds WHERE id = NEW.task_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER task_time_total AFTER INSERT OR UPDATE OR DELETE ON time_entry
  FOR EACH ROW EXECUTE FUNCTION sync_task_time_total();
