CREATE TABLE "task_worklog" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text,
	"work_date" date NOT NULL,
	"duration" integer NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_worklog_duration_range" CHECK ("task_worklog"."duration" BETWEEN 1 AND 86400)
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "estimated_seconds" bigint;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "progress" integer;--> statement-breakpoint
ALTER TABLE "task_worklog" ADD CONSTRAINT "task_worklog_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_worklog" ADD CONSTRAINT "task_worklog_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_worklog_task_date_idx" ON "task_worklog" USING btree ("task_id","work_date","id");--> statement-breakpoint
CREATE INDEX "task_worklog_date_idx" ON "task_worklog" USING btree ("work_date");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_estimate_positive" CHECK ("task"."estimated_seconds" > 0);--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_progress_range" CHECK ("task"."progress" BETWEEN 0 AND 100);
--> statement-breakpoint
-- Date-only logs add to the existing total; legacy totals retain their unknown work dates.
CREATE FUNCTION sync_task_worklog_total() RETURNS trigger AS $$
DECLARE old_seconds bigint := 0; new_seconds bigint := 0;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_seconds := OLD.duration; END IF;
  IF TG_OP <> 'DELETE' THEN new_seconds := NEW.duration; END IF;
  UPDATE task SET tracked_seconds = GREATEST(0, tracked_seconds + new_seconds - old_seconds)
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.task_id ELSE NEW.task_id END;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER task_worklog_total AFTER INSERT OR UPDATE OR DELETE ON task_worklog
  FOR EACH ROW EXECUTE FUNCTION sync_task_worklog_total();
