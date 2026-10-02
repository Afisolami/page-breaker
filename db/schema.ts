import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leaderboardScores = sqliteTable("leaderboard_scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerName: text("player_name").notNull(),
  websiteHost: text("website_host").notNull(),
  destroyedCount: integer("destroyed_count").notNull(),
  totalBricks: integer("total_bricks").notNull(),
  durationMs: integer("duration_ms").notNull(),
  score: integer("score").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_leaderboard_rank").on(table.destroyedCount, table.durationMs, table.score),
]);
