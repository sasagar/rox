CREATE TABLE IF NOT EXISTS "deck_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deck_profiles" ADD CONSTRAINT "deck_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deck_profile_user_idx" ON "deck_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deck_profile_user_name_idx" ON "deck_profiles" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deck_profile_user_default_idx" ON "deck_profiles" USING btree ("user_id") WHERE "deck_profiles"."is_default" = true;