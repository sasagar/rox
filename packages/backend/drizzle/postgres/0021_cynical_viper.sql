CREATE TABLE IF NOT EXISTS "remote_instances" (
	"host" text PRIMARY KEY NOT NULL,
	"software_name" text,
	"software_version" text,
	"name" text,
	"description" text,
	"icon_url" text,
	"theme_color" text,
	"open_registrations" boolean,
	"users_count" integer,
	"notes_count" integer,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"last_fetched_at" timestamp,
	"fetch_error_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remote_instance_software_name_idx" ON "remote_instances" USING btree ("software_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remote_instance_last_fetched_at_idx" ON "remote_instances" USING btree ("last_fetched_at");