CREATE TABLE `besucher_kontakte` (
	`besitzer_guid` text NOT NULL,
	`kontakt_guid` text NOT NULL,
	`zeitpunkt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`besitzer_guid`) REFERENCES `besucher`(`guid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kontakt_guid`) REFERENCES `besucher`(`guid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `besucher_kontakte_kontakt_idx` ON `besucher_kontakte` (`kontakt_guid`);--> statement-breakpoint
CREATE UNIQUE INDEX `besucher_kontakte_paar` ON `besucher_kontakte` (`besitzer_guid`,`kontakt_guid`);