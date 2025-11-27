CREATE TABLE IF NOT EXISTS "custom_emojis" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"host" text,
	"category" text,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"url" text NOT NULL,
	"public_url" text,
	"license" text,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"local_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "emoji_name_host_idx" ON "custom_emojis" USING btree ("name","host");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emoji_host_idx" ON "custom_emojis" USING btree ("host");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emoji_category_idx" ON "custom_emojis" USING btree ("category");