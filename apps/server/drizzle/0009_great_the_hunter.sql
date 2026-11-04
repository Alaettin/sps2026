CREATE TABLE `avatar_entwuerfe` (
	`datei_id` text PRIMARY KEY NOT NULL,
	`angelegt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`datei_id`) REFERENCES `dateien`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `avatare` ADD `herkunft` text DEFAULT 'vorlage' NOT NULL;