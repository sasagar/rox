CREATE TABLE IF NOT EXISTS "contact_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"sender_id" text,
	"sender_type" text NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"attachment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"subject" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"email" text,
	"assigned_to_id" text,
	"priority" integer DEFAULT 2 NOT NULL,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_thread_id_contact_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."contact_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_threads" ADD CONSTRAINT "contact_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_threads" ADD CONSTRAINT "contact_threads_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_message_thread_id_idx" ON "contact_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_message_sender_id_idx" ON "contact_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_message_created_at_idx" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_thread_user_id_idx" ON "contact_threads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_thread_status_idx" ON "contact_threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_thread_category_idx" ON "contact_threads" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_thread_created_at_idx" ON "contact_threads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_thread_assigned_to_idx" ON "contact_threads" USING btree ("assigned_to_id");