CREATE TABLE `custom_emojis` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`host` text,
	`category` text,
	`aliases` text DEFAULT '[]' NOT NULL,
	`url` text NOT NULL,
	`public_url` text,
	`license` text,
	`is_sensitive` integer DEFAULT false NOT NULL,
	`local_only` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emoji_name_host_idx` ON `custom_emojis` (`name`,`host`);--> statement-breakpoint
CREATE INDEX `emoji_host_idx` ON `custom_emojis` (`host`);--> statement-breakpoint
CREATE INDEX `emoji_category_idx` ON `custom_emojis` (`category`);--> statement-breakpoint
CREATE TABLE `drive_files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`folder_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`md5` text NOT NULL,
	`url` text NOT NULL,
	`thumbnail_url` text,
	`blurhash` text,
	`comment` text,
	`is_sensitive` integer DEFAULT false NOT NULL,
	`storage_key` text NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `drive_folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `file_user_id_idx` ON `drive_files` (`user_id`);--> statement-breakpoint
CREATE INDEX `file_folder_id_idx` ON `drive_files` (`folder_id`);--> statement-breakpoint
CREATE INDEX `file_md5_idx` ON `drive_files` (`md5`);--> statement-breakpoint
CREATE INDEX `file_source_idx` ON `drive_files` (`source`);--> statement-breakpoint
CREATE TABLE `drive_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `folder_user_id_idx` ON `drive_folders` (`user_id`);--> statement-breakpoint
CREATE INDEX `folder_parent_id_idx` ON `drive_folders` (`parent_id`);--> statement-breakpoint
CREATE TABLE `follows` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`followee_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`followee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follow_follower_followee_idx` ON `follows` (`follower_id`,`followee_id`);--> statement-breakpoint
CREATE INDEX `follow_follower_idx` ON `follows` (`follower_id`);--> statement-breakpoint
CREATE INDEX `follow_followee_idx` ON `follows` (`followee_id`);--> statement-breakpoint
CREATE TABLE `instance_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`reason` text,
	`blocked_by_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`blocked_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instance_blocks_host_unique` ON `instance_blocks` (`host`);--> statement-breakpoint
CREATE UNIQUE INDEX `instance_block_host_idx` ON `instance_blocks` (`host`);--> statement-breakpoint
CREATE TABLE `instance_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by_id` text,
	FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `invitation_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_by_id` text NOT NULL,
	`used_by_id` text,
	`used_at` integer,
	`expires_at` integer,
	`max_uses` integer DEFAULT 1,
	`use_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_codes_code_unique` ON `invitation_codes` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_code_idx` ON `invitation_codes` (`code`);--> statement-breakpoint
CREATE INDEX `invitation_created_by_idx` ON `invitation_codes` (`created_by_id`);--> statement-breakpoint
CREATE TABLE `moderation_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`moderator_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text,
	`details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`moderator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_moderator_idx` ON `moderation_audit_logs` (`moderator_id`);--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `moderation_audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_target_type_idx` ON `moderation_audit_logs` (`target_type`);--> statement-breakpoint
CREATE INDEX `audit_target_id_idx` ON `moderation_audit_logs` (`target_id`);--> statement-breakpoint
CREATE INDEX `audit_created_at_idx` ON `moderation_audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`text` text,
	`cw` text,
	`visibility` text DEFAULT 'public' NOT NULL,
	`local_only` integer DEFAULT false NOT NULL,
	`reply_id` text,
	`renote_id` text,
	`file_ids` text DEFAULT '[]' NOT NULL,
	`mentions` text DEFAULT '[]' NOT NULL,
	`emojis` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`uri` text,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`deleted_by_id` text,
	`deletion_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deleted_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `note_user_id_idx` ON `notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `note_created_at_idx` ON `notes` (`created_at`);--> statement-breakpoint
CREATE INDEX `note_reply_id_idx` ON `notes` (`reply_id`);--> statement-breakpoint
CREATE INDEX `note_renote_id_idx` ON `notes` (`renote_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `note_uri_idx` ON `notes` (`uri`);--> statement-breakpoint
CREATE INDEX `note_user_timeline_idx` ON `notes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `note_is_deleted_idx` ON `notes` (`is_deleted`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`notifier_id` text,
	`note_id` text,
	`reaction` text,
	`warning_id` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`notifier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`warning_id`) REFERENCES `user_warnings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_user_id_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notification_user_id_is_read_idx` ON `notifications` (`user_id`,`is_read`);--> statement-breakpoint
CREATE INDEX `notification_user_id_created_at_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_type_idx` ON `notifications` (`type`);--> statement-breakpoint
CREATE TABLE `passkey_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`user_id` text,
	`type` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_challenges_challenge_unique` ON `passkey_challenges` (`challenge`);--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_challenge_idx` ON `passkey_challenges` (`challenge`);--> statement-breakpoint
CREATE INDEX `passkey_challenge_expires_idx` ON `passkey_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `passkey_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`device_type` text,
	`backed_up` integer DEFAULT false NOT NULL,
	`transports` text DEFAULT '[]',
	`name` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_credentials_credential_id_unique` ON `passkey_credentials` (`credential_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_credential_id_idx` ON `passkey_credentials` (`credential_id`);--> statement-breakpoint
CREATE INDEX `passkey_user_id_idx` ON `passkey_credentials` (`user_id`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_subscription_user_id_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscription_endpoint_idx` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`note_id` text NOT NULL,
	`reaction` text NOT NULL,
	`custom_emoji_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reaction_user_note_reaction_idx` ON `reactions` (`user_id`,`note_id`,`reaction`);--> statement-breakpoint
CREATE INDEX `reaction_note_id_idx` ON `reactions` (`note_id`);--> statement-breakpoint
CREATE TABLE `received_activities` (
	`activity_id` text PRIMARY KEY NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `received_activities_received_at_idx` ON `received_activities` (`received_at`);--> statement-breakpoint
CREATE TABLE `remote_instances` (
	`host` text PRIMARY KEY NOT NULL,
	`software_name` text,
	`software_version` text,
	`name` text,
	`description` text,
	`icon_url` text,
	`theme_color` text,
	`open_registrations` integer,
	`users_count` integer,
	`notes_count` integer,
	`is_blocked` integer DEFAULT false NOT NULL,
	`last_fetched_at` integer,
	`fetch_error_count` integer DEFAULT 0 NOT NULL,
	`last_fetch_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `remote_instance_software_name_idx` ON `remote_instances` (`software_name`);--> statement-breakpoint
CREATE INDEX `remote_instance_last_fetched_at_idx` ON `remote_instances` (`last_fetched_at`);--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`expires_at` integer,
	`assigned_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_assignment_user_role_idx` ON `role_assignments` (`user_id`,`role_id`);--> statement-breakpoint
CREATE INDEX `role_assignment_user_idx` ON `role_assignments` (`user_id`);--> statement-breakpoint
CREATE INDEX `role_assignment_role_idx` ON `role_assignments` (`role_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`icon_url` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_admin_role` integer DEFAULT false NOT NULL,
	`is_moderator_role` integer DEFAULT false NOT NULL,
	`policies` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `role_name_idx` ON `roles` (`name`);--> statement-breakpoint
CREATE INDEX `role_display_order_idx` ON `roles` (`display_order`);--> statement-breakpoint
CREATE TABLE `scheduled_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`text` text,
	`cw` text,
	`visibility` text DEFAULT 'public' NOT NULL,
	`local_only` integer DEFAULT false NOT NULL,
	`reply_id` text,
	`renote_id` text,
	`file_ids` text DEFAULT '[]' NOT NULL,
	`scheduled_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`published_note_id` text,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`published_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scheduled_note_user_id_idx` ON `scheduled_notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `scheduled_note_scheduled_at_idx` ON `scheduled_notes` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `scheduled_note_status_idx` ON `scheduled_notes` (`status`);--> statement-breakpoint
CREATE INDEX `scheduled_note_pending_schedule_idx` ON `scheduled_notes` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent` text,
	`ip_address` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `token_idx` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_user_id` text,
	`target_note_id` text,
	`reason` text NOT NULL,
	`comment` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolved_by_id` text,
	`resolved_at` integer,
	`resolution` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `report_reporter_idx` ON `user_reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `report_target_user_idx` ON `user_reports` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `report_target_note_idx` ON `user_reports` (`target_note_id`);--> statement-breakpoint
CREATE INDEX `report_status_idx` ON `user_reports` (`status`);--> statement-breakpoint
CREATE INDEX `report_created_at_idx` ON `user_reports` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_warnings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`moderator_id` text NOT NULL,
	`reason` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`read_at` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`moderator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `warning_user_idx` ON `user_warnings` (`user_id`);--> statement-breakpoint
CREATE INDEX `warning_moderator_idx` ON `user_warnings` (`moderator_id`);--> statement-breakpoint
CREATE INDEX `warning_is_read_idx` ON `user_warnings` (`is_read`);--> statement-breakpoint
CREATE INDEX `warning_created_at_idx` ON `user_warnings` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`bio` text,
	`avatar_url` text,
	`banner_url` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`is_suspended` integer DEFAULT false NOT NULL,
	`public_key` text,
	`private_key` text,
	`host` text,
	`inbox` text,
	`outbox` text,
	`followers_url` text,
	`following_url` text,
	`uri` text,
	`shared_inbox` text,
	`also_known_as` text DEFAULT '[]',
	`moved_to` text,
	`moved_at` integer,
	`custom_css` text,
	`ui_settings` text,
	`profile_emojis` text DEFAULT '[]',
	`storage_quota_mb` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `username_host_idx` ON `users` (`username`,`host`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `uri_idx` ON `users` (`uri`);