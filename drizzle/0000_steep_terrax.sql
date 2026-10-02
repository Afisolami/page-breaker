CREATE TABLE `leaderboard_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_name` text NOT NULL,
	`website_host` text NOT NULL,
	`destroyed_count` integer NOT NULL,
	`total_bricks` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`score` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_leaderboard_rank` ON `leaderboard_scores` (`destroyed_count`,`duration_ms`,`score`);
--> statement-breakpoint
PRAGMA optimize;
