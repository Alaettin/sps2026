CREATE TABLE `nachrichten` (
	`id` text PRIMARY KEY NOT NULL,
	`besucher_guid` text NOT NULL,
	`platz` integer NOT NULL,
	`titel` text,
	`text` text,
	`bild_datei_id` text,
	`angelegt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`geaendert` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`besucher_guid`) REFERENCES `besucher`(`guid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bild_datei_id`) REFERENCES `dateien`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `nachrichten_besucher_idx` ON `nachrichten` (`besucher_guid`);--> statement-breakpoint
CREATE UNIQUE INDEX `nachrichten_platz` ON `nachrichten` (`besucher_guid`,`platz`);