CREATE TABLE `geographies` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`geography_type` text NOT NULL,
	`parent_id` text,
	`shared_id` text,
	FOREIGN KEY (`geography_type`) REFERENCES `geography_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `geographies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `geography_types` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`label_singular` text,
	`order` integer,
	`is_available` integer DEFAULT true
);
