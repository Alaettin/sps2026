PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_besucher` (
	`guid` text PRIMARY KEY NOT NULL,
	`titel` text,
	`vorname` text NOT NULL,
	`nachname` text NOT NULL,
	`alias` text,
	`firma` text,
	`position` text,
	`email` text NOT NULL,
	`strasse` text,
	`plz` text,
	`ort` text,
	`land` text,
	`website` text,
	`avatar_datei_id` text,
	`passwort_hash` text,
	`angelegt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`geaendert` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`avatar_datei_id`) REFERENCES `dateien`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_besucher`("guid", "titel", "vorname", "nachname", "alias", "firma", "position", "email", "strasse", "plz", "ort", "land", "website", "avatar_datei_id", "angelegt", "geaendert") SELECT "guid", "titel", "vorname", "nachname", "alias", "firma", "position", "email", "strasse", "plz", "ort", "land", "website", "avatar_datei_id", "angelegt", "geaendert" FROM `besucher`;--> statement-breakpoint
DROP TABLE `besucher`;--> statement-breakpoint
ALTER TABLE `__new_besucher` RENAME TO `besucher`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `besucher_email_eindeutig` ON `besucher` (lower("email"));