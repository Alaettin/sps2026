-- Sprache der Einwilligung, seit dem 03.11.2026. Wer vorher zugestimmt hat, sah nur den deutschen Text.
ALTER TABLE `besucher` ADD `einwilligung_sprache` text;--> statement-breakpoint
UPDATE `besucher` SET `einwilligung_sprache` = 'de' WHERE `einwilligung_am` IS NOT NULL;
