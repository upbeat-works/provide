CREATE TABLE `geography_parents` (
	`geography_id` text NOT NULL,
	`parent_id` text NOT NULL,
	PRIMARY KEY(`geography_id`, `parent_id`),
	FOREIGN KEY (`geography_id`) REFERENCES `geographies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `geographies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_geographies` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`geography_type` text NOT NULL,
	FOREIGN KEY (`geography_type`) REFERENCES `geography_types`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_geographies`("id", "label", "geography_type") SELECT "id", "label", "geography_type" FROM `geographies`;--> statement-breakpoint
DROP TABLE `geographies`;--> statement-breakpoint
ALTER TABLE `__new_geographies` RENAME TO `geographies`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `geography_types` ADD `is_selectable` integer DEFAULT true;