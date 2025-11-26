CREATE TABLE IF NOT EXISTS "instance_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"host" text NOT NULL,
	"reason" text,
	"blocked_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "instance_blocks_host_unique" UNIQUE("host")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "instance_blocks" ADD CONSTRAINT "instance_blocks_blocked_by_id_users_id_fk" FOREIGN KEY ("blocked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "instance_block_host_idx" ON "instance_blocks" USING btree ("host");