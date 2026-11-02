-- Die Nachrichten der Besucher entfallen (02.11.2026). Erst ihre Bilder aus `dateien`, sonst
-- blieben Datensaetze stehen, an denen nichts mehr haengt.
DELETE FROM `dateien` WHERE `id` IN (SELECT `bild_datei_id` FROM `nachrichten` WHERE `bild_datei_id` IS NOT NULL);--> statement-breakpoint
DROP TABLE `nachrichten`;
