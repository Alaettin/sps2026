CREATE TABLE `oidc_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`besucher_guid` text NOT NULL,
	`client_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`code_challenge` text NOT NULL,
	`nonce` text,
	`scope` text NOT NULL,
	`auth_time` integer NOT NULL,
	`ablauf` integer NOT NULL,
	FOREIGN KEY (`besucher_guid`) REFERENCES `besucher`(`guid`) ON UPDATE no action ON DELETE cascade
);
