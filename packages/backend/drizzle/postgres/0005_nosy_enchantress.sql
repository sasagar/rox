ALTER TABLE "users" ADD COLUMN "gone_detected_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fetch_failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_fetch_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_fetch_error" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_gone_detected_idx" ON "users" USING btree ("gone_detected_at");