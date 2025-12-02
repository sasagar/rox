CREATE TABLE IF NOT EXISTS "scheduled_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text,
	"cw" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"local_only" boolean DEFAULT false NOT NULL,
	"reply_id" text,
	"renote_id" text,
	"file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"published_note_id" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drive_files" ADD COLUMN "source" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "storage_quota_mb" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_notes" ADD CONSTRAINT "scheduled_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_notes" ADD CONSTRAINT "scheduled_notes_published_note_id_notes_id_fk" FOREIGN KEY ("published_note_id") REFERENCES "public"."notes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_note_user_id_idx" ON "scheduled_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_note_scheduled_at_idx" ON "scheduled_notes" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_note_status_idx" ON "scheduled_notes" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_note_pending_schedule_idx" ON "scheduled_notes" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_source_idx" ON "drive_files" USING btree ("source");