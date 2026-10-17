CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"max_upload_bytes" integer NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "instance_settings_singleton" CHECK ("instance_settings"."id" = 'uploads'),
	CONSTRAINT "instance_settings_upload_limit" CHECK ("instance_settings"."max_upload_bytes" BETWEEN 1048576 AND 1073741824)
);
