ALTER TABLE "users" ADD COLUMN "also_known_as" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "moved_to" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "moved_at" timestamp;