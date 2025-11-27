ALTER TABLE "notes" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "deleted_by_id" text;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "deletion_reason" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notes" ADD CONSTRAINT "notes_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_is_deleted_idx" ON "notes" USING btree ("is_deleted");