CREATE TABLE `besuche` (
	`besucher_guid` text NOT NULL,
	`exponat_id` text NOT NULL,
	`zeitpunkt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`besucher_guid`) REFERENCES `besucher`(`guid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exponat_id`) REFERENCES `exponate`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `besuche_exponat_idx` ON `besuche` (`exponat_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `besuche_paar` ON `besuche` (`besucher_guid`,`exponat_id`);--> statement-breakpoint
CREATE TABLE `exponat_kontakte` (
	`id` text PRIMARY KEY NOT NULL,
	`exponat_id` text NOT NULL,
	`platz` integer NOT NULL,
	`titel` text,
	`vorname` text NOT NULL,
	`nachname` text NOT NULL,
	`firma` text,
	`position` text,
	`email` text,
	`strasse` text,
	`plz` text,
	`ort` text,
	`land` text,
	`website` text,
	`angelegt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`geaendert` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`exponat_id`) REFERENCES `exponate`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exponat_kontakte_platz` ON `exponat_kontakte` (`exponat_id`,`platz`);--> statement-breakpoint
ALTER TABLE `exponate` ADD `scan_code` text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `exponate` SET `scan_code` = lower(hex(randomblob(16)));--> statement-breakpoint
CREATE UNIQUE INDEX `exponate_scan_code_unique` ON `exponate` (`scan_code`);--> statement-breakpoint
INSERT INTO `besuche` (`besucher_guid`, `exponat_id`, `zeitpunkt`)
	SELECT `besucher_guid`, `exponat_id`, min(`zeitpunkt`) FROM `zuordnungen` GROUP BY `besucher_guid`, `exponat_id`;--> statement-breakpoint
INSERT INTO `exponat_kontakte` (`id`, `exponat_id`, `platz`, `titel`, `vorname`, `nachname`, `firma`, `position`, `email`, `strasse`, `plz`, `ort`, `land`, `website`, `angelegt`, `geaendert`)
	SELECT lower(hex(randomblob(16))), z.`exponat_id`, z.`platz`, a.`titel`, a.`vorname`, a.`nachname`, a.`firma`, a.`position`, a.`email`, a.`strasse`, a.`plz`, a.`ort`, a.`land`, a.`website`, a.`angelegt`, a.`geaendert`
	FROM `exponat_ansprechpartner` z INNER JOIN `ansprechpartner` a ON a.`id` = z.`ansprechpartner_id`;
