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
CREATE TABLE IF NOT EXISTS "drive_files" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"folder_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"md5" text NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"blurhash" text,
	"comment" text,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"storage_key" text NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drive_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "follows" (
	"id" text PRIMARY KEY NOT NULL,
	"follower_id" text NOT NULL,
	"followee_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "instance_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"host" text NOT NULL,
	"reason" text,
	"blocked_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "instance_blocks_host_unique" UNIQUE("host")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "instance_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitation_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_by_id" text NOT NULL,
	"used_by_id" text,
	"used_at" timestamp,
	"expires_at" timestamp,
	"max_uses" integer DEFAULT 1,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moderation_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"moderator_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text,
	"cw" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"local_only" boolean DEFAULT false NOT NULL,
	"reply_id" text,
	"renote_id" text,
	"file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emojis" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uri" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_id" text,
	"deletion_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"notifier_id" text,
	"note_id" text,
	"reaction" text,
	"warning_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"note_id" text NOT NULL,
	"reaction" text NOT NULL,
	"custom_emoji_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "received_activities" (
	"activity_id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "remote_instances" (
	"host" text PRIMARY KEY NOT NULL,
	"software_name" text,
	"software_version" text,
	"name" text,
	"description" text,
	"icon_url" text,
	"theme_color" text,
	"open_registrations" boolean,
	"users_count" integer,
	"notes_count" integer,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"last_fetched_at" timestamp,
	"fetch_error_count" integer DEFAULT 0 NOT NULL,
	"last_fetch_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"expires_at" timestamp,
	"assigned_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"icon_url" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_admin_role" boolean DEFAULT false NOT NULL,
	"is_moderator_role" boolean DEFAULT false NOT NULL,
	"policies" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text,
	"cw" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"local_only" boolean DEFAULT false NOT NULL,
	"reply_id" text,
	"renote_id" text,
	"file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"published_note_id" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"target_user_id" text,
	"target_note_id" text,
	"reason" text NOT NULL,
	"comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_by_id" text,
	"resolved_at" timestamp,
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_warnings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"reason" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"bio" text,
	"avatar_url" text,
	"banner_url" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"public_key" text,
	"private_key" text,
	"host" text,
	"inbox" text,
	"outbox" text,
	"followers_url" text,
	"following_url" text,
	"uri" text,
	"shared_inbox" text,
	"also_known_as" jsonb DEFAULT '[]'::jsonb,
	"moved_to" text,
	"moved_at" timestamp,
	"custom_css" text,
	"ui_settings" jsonb,
	"profile_emojis" jsonb DEFAULT '[]'::jsonb,
	"storage_quota_mb" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_folder_id_drive_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."drive_folders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drive_folders" ADD CONSTRAINT "drive_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_users_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "instance_blocks" ADD CONSTRAINT "instance_blocks_blocked_by_id_users_id_fk" FOREIGN KEY ("blocked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "instance_settings" ADD CONSTRAINT "instance_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_used_by_id_users_id_fk" FOREIGN KEY ("used_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moderation_audit_logs" ADD CONSTRAINT "moderation_audit_logs_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notes" ADD CONSTRAINT "notes_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_notifier_id_users_id_fk" FOREIGN KEY ("notifier_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_warning_id_user_warnings_id_fk" FOREIGN KEY ("warning_id") REFERENCES "public"."user_warnings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reactions" ADD CONSTRAINT "reactions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_notes" ADD CONSTRAINT "scheduled_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_notes" ADD CONSTRAINT "scheduled_notes_published_note_id_notes_id_fk" FOREIGN KEY ("published_note_id") REFERENCES "public"."notes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_target_note_id_notes_id_fk" FOREIGN KEY ("target_note_id") REFERENCES "public"."notes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_warnings" ADD CONSTRAINT "user_warnings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_warnings" ADD CONSTRAINT "user_warnings_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "emoji_name_host_idx" ON "custom_emojis" USING btree ("name","host");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emoji_host_idx" ON "custom_emojis" USING btree ("host");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emoji_category_idx" ON "custom_emojis" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_user_id_idx" ON "drive_files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_folder_id_idx" ON "drive_files" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_md5_idx" ON "drive_files" USING btree ("md5");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_source_idx" ON "drive_files" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folder_user_id_idx" ON "drive_folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folder_parent_id_idx" ON "drive_folders" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "follow_follower_followee_idx" ON "follows" USING btree ("follower_id","followee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_follower_idx" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_followee_idx" ON "follows" USING btree ("followee_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "instance_block_host_idx" ON "instance_blocks" USING btree ("host");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invitation_code_idx" ON "invitation_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_created_by_idx" ON "invitation_codes" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_moderator_idx" ON "moderation_audit_logs" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "moderation_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_target_type_idx" ON "moderation_audit_logs" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_target_id_idx" ON "moderation_audit_logs" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_created_at_idx" ON "moderation_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_user_id_idx" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_created_at_idx" ON "notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_reply_id_idx" ON "notes" USING btree ("reply_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_renote_id_idx" ON "notes" USING btree ("renote_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "note_uri_idx" ON "notes" USING btree ("uri");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_user_timeline_idx" ON "notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_local_timeline_idx" ON "notes" USING btree ("visibility","local_only","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_is_deleted_idx" ON "notes" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_user_id_is_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_user_id_created_at_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscription_user_id_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscription_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reaction_user_note_reaction_idx" ON "reactions" USING btree ("user_id","note_id","reaction");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reaction_note_id_idx" ON "reactions" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "received_activities_received_at_idx" ON "received_activities" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remote_instance_software_name_idx" ON "remote_instances" USING btree ("software_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remote_instance_last_fetched_at_idx" ON "remote_instances" USING btree ("last_fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_assignment_user_role_idx" ON "role_assignments" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_assignment_user_idx" ON "role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_assignment_role_idx" ON "role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_name_idx" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_display_order_idx" ON "roles" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_note_user_id_idx" ON "scheduled_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_note_scheduled_at_idx" ON "scheduled_notes" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_note_status_idx" ON "scheduled_notes" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_note_pending_schedule_idx" ON "scheduled_notes" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_reporter_idx" ON "user_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_target_user_idx" ON "user_reports" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_target_note_idx" ON "user_reports" USING btree ("target_note_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_status_idx" ON "user_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_created_at_idx" ON "user_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warning_user_idx" ON "user_warnings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warning_moderator_idx" ON "user_warnings" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warning_is_read_idx" ON "user_warnings" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warning_created_at_idx" ON "user_warnings" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "username_host_idx" ON "users" USING btree ("username","host");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uri_idx" ON "users" USING btree ("uri");