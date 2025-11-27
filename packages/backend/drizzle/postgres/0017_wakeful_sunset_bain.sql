CREATE TABLE IF NOT EXISTS "user_warnings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"reason" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_warnings" ADD CONSTRAINT "user_warnings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_warnings" ADD CONSTRAINT "user_warnings_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warning_user_idx" ON "user_warnings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warning_moderator_idx" ON "user_warnings" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warning_is_read_idx" ON "user_warnings" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warning_created_at_idx" ON "user_warnings" USING btree ("created_at");