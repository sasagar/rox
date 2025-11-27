CREATE TABLE IF NOT EXISTS "moderation_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"moderator_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moderation_audit_logs" ADD CONSTRAINT "moderation_audit_logs_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_moderator_idx" ON "moderation_audit_logs" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "moderation_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_target_type_idx" ON "moderation_audit_logs" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_target_id_idx" ON "moderation_audit_logs" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_created_at_idx" ON "moderation_audit_logs" USING btree ("created_at");