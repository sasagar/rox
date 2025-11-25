CREATE TABLE IF NOT EXISTS "received_activities" (
	"activity_id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "received_activities_received_at_idx" ON "received_activities" USING btree ("received_at");