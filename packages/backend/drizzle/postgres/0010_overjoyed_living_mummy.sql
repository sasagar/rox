CREATE TABLE IF NOT EXISTS "user_list_members" (
	"id" text PRIMARY KEY NOT NULL,
	"list_id" text NOT NULL,
	"user_id" text NOT NULL,
	"with_replies" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_lists" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_list_members" ADD CONSTRAINT "user_list_members_list_id_user_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."user_lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_list_members" ADD CONSTRAINT "user_list_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_lists" ADD CONSTRAINT "user_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_list_member_list_user_idx" ON "user_list_members" USING btree ("list_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_list_member_list_idx" ON "user_list_members" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_list_member_user_idx" ON "user_list_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_list_user_idx" ON "user_lists" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_list_user_name_idx" ON "user_lists" USING btree ("user_id","name");