ALTER TABLE "users" ADD COLUMN "inbox" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "outbox" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "followers_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "following_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "uri" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uri_idx" ON "users" USING btree ("uri");