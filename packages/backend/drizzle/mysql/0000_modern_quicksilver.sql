CREATE TABLE `custom_emojis` (
	`id` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`host` varchar(256),
	`category` varchar(64),
	`aliases` json NOT NULL DEFAULT ('[]'),
	`url` text NOT NULL,
	`public_url` text,
	`license` text,
	`is_sensitive` boolean NOT NULL DEFAULT false,
	`local_only` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `custom_emojis_id` PRIMARY KEY(`id`),
	CONSTRAINT `emoji_name_host_idx` UNIQUE(`name`,`host`)
);
--> statement-breakpoint
CREATE TABLE `drive_files` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`folder_id` varchar(32),
	`name` varchar(256) NOT NULL,
	`type` varchar(128) NOT NULL,
	`size` int NOT NULL,
	`md5` varchar(32) NOT NULL,
	`url` text NOT NULL,
	`thumbnail_url` text,
	`blurhash` varchar(128),
	`comment` text,
	`is_sensitive` boolean NOT NULL DEFAULT false,
	`storage_key` varchar(512) NOT NULL,
	`source` varchar(32) NOT NULL DEFAULT 'user',
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `drive_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drive_folders` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`parent_id` varchar(32),
	`name` varchar(256) NOT NULL,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `drive_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`id` varchar(32) NOT NULL,
	`follower_id` varchar(32) NOT NULL,
	`followee_id` varchar(32) NOT NULL,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `follows_id` PRIMARY KEY(`id`),
	CONSTRAINT `follow_follower_followee_idx` UNIQUE(`follower_id`,`followee_id`)
);
--> statement-breakpoint
CREATE TABLE `instance_blocks` (
	`id` varchar(32) NOT NULL,
	`host` varchar(256) NOT NULL,
	`reason` text,
	`blocked_by_id` varchar(32) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `instance_blocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `instance_blocks_host_unique` UNIQUE(`host`),
	CONSTRAINT `instance_block_host_idx` UNIQUE(`host`)
);
--> statement-breakpoint
CREATE TABLE `instance_settings` (
	`key` varchar(128) NOT NULL,
	`value` json NOT NULL,
	`updated_at` datetime NOT NULL,
	`updated_by_id` varchar(32),
	CONSTRAINT `instance_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `invitation_codes` (
	`id` varchar(32) NOT NULL,
	`code` varchar(64) NOT NULL,
	`created_by_id` varchar(32) NOT NULL,
	`used_by_id` varchar(32),
	`used_at` datetime,
	`expires_at` datetime,
	`max_uses` int DEFAULT 1,
	`use_count` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	CONSTRAINT `invitation_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitation_codes_code_unique` UNIQUE(`code`),
	CONSTRAINT `invitation_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `moderation_audit_logs` (
	`id` varchar(32) NOT NULL,
	`moderator_id` varchar(32) NOT NULL,
	`action` varchar(64) NOT NULL,
	`target_type` varchar(32) NOT NULL,
	`target_id` varchar(32) NOT NULL,
	`reason` text,
	`details` json,
	`created_at` datetime NOT NULL,
	CONSTRAINT `moderation_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`text` text,
	`cw` varchar(256),
	`visibility` varchar(32) NOT NULL DEFAULT 'public',
	`local_only` boolean NOT NULL DEFAULT false,
	`reply_id` varchar(32),
	`renote_id` varchar(32),
	`file_ids` json NOT NULL DEFAULT ('[]'),
	`mentions` json NOT NULL DEFAULT ('[]'),
	`emojis` json NOT NULL DEFAULT ('[]'),
	`tags` json NOT NULL DEFAULT ('[]'),
	`uri` varchar(512),
	`is_deleted` boolean NOT NULL DEFAULT false,
	`deleted_at` datetime,
	`deleted_by_id` varchar(32),
	`deletion_reason` text,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `note_uri_idx` UNIQUE(`uri`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`type` varchar(32) NOT NULL,
	`notifier_id` varchar(32),
	`note_id` varchar(32),
	`reaction` varchar(256),
	`warning_id` varchar(32),
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `passkey_challenges` (
	`id` varchar(32) NOT NULL,
	`challenge` varchar(256) NOT NULL,
	`user_id` varchar(32),
	`type` varchar(32) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `passkey_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `passkey_challenges_challenge_unique` UNIQUE(`challenge`),
	CONSTRAINT `passkey_challenge_idx` UNIQUE(`challenge`)
);
--> statement-breakpoint
CREATE TABLE `passkey_credentials` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`credential_id` varchar(512) NOT NULL,
	`public_key` text NOT NULL,
	`counter` int NOT NULL DEFAULT 0,
	`device_type` varchar(32),
	`backed_up` boolean NOT NULL DEFAULT false,
	`transports` json DEFAULT ('[]'),
	`name` varchar(128),
	`created_at` datetime NOT NULL,
	`last_used_at` datetime,
	CONSTRAINT `passkey_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `passkey_credentials_credential_id_unique` UNIQUE(`credential_id`),
	CONSTRAINT `passkey_credential_id_idx` UNIQUE(`credential_id`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` varchar(64) NOT NULL,
	`user_agent` text,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`note_id` varchar(32) NOT NULL,
	`reaction` varchar(256) NOT NULL,
	`custom_emoji_url` text,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `reactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `reaction_user_note_reaction_idx` UNIQUE(`user_id`,`note_id`,`reaction`)
);
--> statement-breakpoint
CREATE TABLE `received_activities` (
	`activity_id` varchar(512) NOT NULL,
	`received_at` datetime NOT NULL,
	CONSTRAINT `received_activities_activity_id` PRIMARY KEY(`activity_id`)
);
--> statement-breakpoint
CREATE TABLE `remote_instances` (
	`host` varchar(256) NOT NULL,
	`software_name` varchar(64),
	`software_version` varchar(64),
	`name` varchar(256),
	`description` text,
	`icon_url` text,
	`theme_color` varchar(16),
	`open_registrations` boolean,
	`users_count` int,
	`notes_count` int,
	`is_blocked` boolean NOT NULL DEFAULT false,
	`last_fetched_at` datetime,
	`fetch_error_count` int NOT NULL DEFAULT 0,
	`last_fetch_error` text,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `remote_instances_host` PRIMARY KEY(`host`)
);
--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`role_id` varchar(32) NOT NULL,
	`expires_at` datetime,
	`assigned_by_id` varchar(32),
	`created_at` datetime NOT NULL,
	CONSTRAINT `role_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_assignment_user_role_idx` UNIQUE(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` varchar(32) NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` text,
	`color` varchar(16),
	`icon_url` text,
	`display_order` int NOT NULL DEFAULT 0,
	`is_public` boolean NOT NULL DEFAULT false,
	`is_default` boolean NOT NULL DEFAULT false,
	`is_admin_role` boolean NOT NULL DEFAULT false,
	`is_moderator_role` boolean NOT NULL DEFAULT false,
	`policies` json NOT NULL DEFAULT ('{}'),
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`),
	CONSTRAINT `role_name_idx` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_notes` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`text` text,
	`cw` varchar(256),
	`visibility` varchar(32) NOT NULL DEFAULT 'public',
	`local_only` boolean NOT NULL DEFAULT false,
	`reply_id` varchar(32),
	`renote_id` varchar(32),
	`file_ids` json NOT NULL DEFAULT ('[]'),
	`scheduled_at` datetime NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`published_note_id` varchar(32),
	`error_message` text,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `scheduled_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`token` varchar(256) NOT NULL,
	`expires_at` datetime NOT NULL,
	`user_agent` text,
	`ip_address` varchar(45),
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_unique` UNIQUE(`token`),
	CONSTRAINT `token_idx` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user_reports` (
	`id` varchar(32) NOT NULL,
	`reporter_id` varchar(32) NOT NULL,
	`target_user_id` varchar(32),
	`target_note_id` varchar(32),
	`reason` varchar(64) NOT NULL,
	`comment` text,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`resolved_by_id` varchar(32),
	`resolved_at` datetime,
	`resolution` text,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `user_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_warnings` (
	`id` varchar(32) NOT NULL,
	`user_id` varchar(32) NOT NULL,
	`moderator_id` varchar(32) NOT NULL,
	`reason` text NOT NULL,
	`is_read` boolean NOT NULL DEFAULT false,
	`read_at` datetime,
	`expires_at` datetime,
	`created_at` datetime NOT NULL,
	CONSTRAINT `user_warnings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(32) NOT NULL,
	`username` varchar(128) NOT NULL,
	`email` varchar(256) NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` varchar(128),
	`bio` text,
	`avatar_url` text,
	`banner_url` text,
	`is_admin` boolean NOT NULL DEFAULT false,
	`is_suspended` boolean NOT NULL DEFAULT false,
	`public_key` text,
	`private_key` text,
	`host` varchar(256),
	`inbox` text,
	`outbox` text,
	`followers_url` text,
	`following_url` text,
	`uri` varchar(512),
	`shared_inbox` text,
	`also_known_as` json DEFAULT ('[]'),
	`moved_to` text,
	`moved_at` datetime,
	`custom_css` text,
	`ui_settings` json,
	`profile_emojis` json DEFAULT ('[]'),
	`storage_quota_mb` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `username_host_idx` UNIQUE(`username`,`host`),
	CONSTRAINT `email_idx` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `drive_files` ADD CONSTRAINT `drive_files_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drive_files` ADD CONSTRAINT `drive_files_folder_id_drive_folders_id_fk` FOREIGN KEY (`folder_id`) REFERENCES `drive_folders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drive_folders` ADD CONSTRAINT `drive_folders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follows` ADD CONSTRAINT `follows_follower_id_users_id_fk` FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follows` ADD CONSTRAINT `follows_followee_id_users_id_fk` FOREIGN KEY (`followee_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instance_blocks` ADD CONSTRAINT `instance_blocks_blocked_by_id_users_id_fk` FOREIGN KEY (`blocked_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `instance_settings` ADD CONSTRAINT `instance_settings_updated_by_id_users_id_fk` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitation_codes` ADD CONSTRAINT `invitation_codes_created_by_id_users_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitation_codes` ADD CONSTRAINT `invitation_codes_used_by_id_users_id_fk` FOREIGN KEY (`used_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moderation_audit_logs` ADD CONSTRAINT `moderation_audit_logs_moderator_id_users_id_fk` FOREIGN KEY (`moderator_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notes` ADD CONSTRAINT `notes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notes` ADD CONSTRAINT `notes_deleted_by_id_users_id_fk` FOREIGN KEY (`deleted_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_notifier_id_users_id_fk` FOREIGN KEY (`notifier_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_note_id_notes_id_fk` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_warning_id_user_warnings_id_fk` FOREIGN KEY (`warning_id`) REFERENCES `user_warnings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `passkey_challenges` ADD CONSTRAINT `passkey_challenges_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `passkey_credentials` ADD CONSTRAINT `passkey_credentials_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reactions` ADD CONSTRAINT `reactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reactions` ADD CONSTRAINT `reactions_note_id_notes_id_fk` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_assignments` ADD CONSTRAINT `role_assignments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_assignments` ADD CONSTRAINT `role_assignments_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_assignments` ADD CONSTRAINT `role_assignments_assigned_by_id_users_id_fk` FOREIGN KEY (`assigned_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduled_notes` ADD CONSTRAINT `scheduled_notes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduled_notes` ADD CONSTRAINT `scheduled_notes_published_note_id_notes_id_fk` FOREIGN KEY (`published_note_id`) REFERENCES `notes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_reports` ADD CONSTRAINT `user_reports_reporter_id_users_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_reports` ADD CONSTRAINT `user_reports_target_user_id_users_id_fk` FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_reports` ADD CONSTRAINT `user_reports_target_note_id_notes_id_fk` FOREIGN KEY (`target_note_id`) REFERENCES `notes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_reports` ADD CONSTRAINT `user_reports_resolved_by_id_users_id_fk` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_warnings` ADD CONSTRAINT `user_warnings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_warnings` ADD CONSTRAINT `user_warnings_moderator_id_users_id_fk` FOREIGN KEY (`moderator_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `emoji_host_idx` ON `custom_emojis` (`host`);--> statement-breakpoint
CREATE INDEX `emoji_category_idx` ON `custom_emojis` (`category`);--> statement-breakpoint
CREATE INDEX `file_user_id_idx` ON `drive_files` (`user_id`);--> statement-breakpoint
CREATE INDEX `file_folder_id_idx` ON `drive_files` (`folder_id`);--> statement-breakpoint
CREATE INDEX `file_md5_idx` ON `drive_files` (`md5`);--> statement-breakpoint
CREATE INDEX `file_source_idx` ON `drive_files` (`source`);--> statement-breakpoint
CREATE INDEX `folder_user_id_idx` ON `drive_folders` (`user_id`);--> statement-breakpoint
CREATE INDEX `folder_parent_id_idx` ON `drive_folders` (`parent_id`);--> statement-breakpoint
CREATE INDEX `follow_follower_idx` ON `follows` (`follower_id`);--> statement-breakpoint
CREATE INDEX `follow_followee_idx` ON `follows` (`followee_id`);--> statement-breakpoint
CREATE INDEX `invitation_created_by_idx` ON `invitation_codes` (`created_by_id`);--> statement-breakpoint
CREATE INDEX `audit_moderator_idx` ON `moderation_audit_logs` (`moderator_id`);--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `moderation_audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_target_type_idx` ON `moderation_audit_logs` (`target_type`);--> statement-breakpoint
CREATE INDEX `audit_target_id_idx` ON `moderation_audit_logs` (`target_id`);--> statement-breakpoint
CREATE INDEX `audit_created_at_idx` ON `moderation_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `note_user_id_idx` ON `notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `note_created_at_idx` ON `notes` (`created_at`);--> statement-breakpoint
CREATE INDEX `note_reply_id_idx` ON `notes` (`reply_id`);--> statement-breakpoint
CREATE INDEX `note_renote_id_idx` ON `notes` (`renote_id`);--> statement-breakpoint
CREATE INDEX `note_user_timeline_idx` ON `notes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `note_is_deleted_idx` ON `notes` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `notification_user_id_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notification_user_id_is_read_idx` ON `notifications` (`user_id`,`is_read`);--> statement-breakpoint
CREATE INDEX `notification_user_id_created_at_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_type_idx` ON `notifications` (`type`);--> statement-breakpoint
CREATE INDEX `passkey_challenge_expires_idx` ON `passkey_challenges` (`expires_at`);--> statement-breakpoint
CREATE INDEX `passkey_user_id_idx` ON `passkey_credentials` (`user_id`);--> statement-breakpoint
CREATE INDEX `push_subscription_user_id_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `reaction_note_id_idx` ON `reactions` (`note_id`);--> statement-breakpoint
CREATE INDEX `received_activities_received_at_idx` ON `received_activities` (`received_at`);--> statement-breakpoint
CREATE INDEX `remote_instance_software_name_idx` ON `remote_instances` (`software_name`);--> statement-breakpoint
CREATE INDEX `remote_instance_last_fetched_at_idx` ON `remote_instances` (`last_fetched_at`);--> statement-breakpoint
CREATE INDEX `role_assignment_user_idx` ON `role_assignments` (`user_id`);--> statement-breakpoint
CREATE INDEX `role_assignment_role_idx` ON `role_assignments` (`role_id`);--> statement-breakpoint
CREATE INDEX `role_display_order_idx` ON `roles` (`display_order`);--> statement-breakpoint
CREATE INDEX `scheduled_note_user_id_idx` ON `scheduled_notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `scheduled_note_scheduled_at_idx` ON `scheduled_notes` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `scheduled_note_status_idx` ON `scheduled_notes` (`status`);--> statement-breakpoint
CREATE INDEX `scheduled_note_pending_schedule_idx` ON `scheduled_notes` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `report_reporter_idx` ON `user_reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `report_target_user_idx` ON `user_reports` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `report_target_note_idx` ON `user_reports` (`target_note_id`);--> statement-breakpoint
CREATE INDEX `report_status_idx` ON `user_reports` (`status`);--> statement-breakpoint
CREATE INDEX `report_created_at_idx` ON `user_reports` (`created_at`);--> statement-breakpoint
CREATE INDEX `warning_user_idx` ON `user_warnings` (`user_id`);--> statement-breakpoint
CREATE INDEX `warning_moderator_idx` ON `user_warnings` (`moderator_id`);--> statement-breakpoint
CREATE INDEX `warning_is_read_idx` ON `user_warnings` (`is_read`);--> statement-breakpoint
CREATE INDEX `warning_created_at_idx` ON `user_warnings` (`created_at`);--> statement-breakpoint
CREATE INDEX `uri_idx` ON `users` (`uri`);