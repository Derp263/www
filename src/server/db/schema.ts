import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { AdapterAccount } from 'next-auth/adapters'

// Game modes supported by the ranked queue system
export enum GameMode {
  VANILLA = 'vanilla',
  STANDARD = 'standard',
  BADLATRO = 'badlatro',
}

export const raw_history = pgTable(
  'raw_history',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    game_num: integer('game_num').notNull(),
    entry: json(),
  },
  (t) => [uniqueIndex('game_num_unique_idx').on(t.game_num)]
)
export const metadata = pgTable('metadata', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
})
export const player_games = pgTable(
  'player_games',
  {
    playerId: text('player_id').notNull(),
    playerName: text('player_name').notNull(),
    gameId: integer('game_id').notNull(),
    gameTime: timestamp('game_time').notNull(),
    gameType: text('game_type').notNull(),
    gameNum: integer('game_num').notNull(),
    playerMmr: real('player_mmr').notNull(),
    mmrChange: real('mmr_change').notNull(),
    opponentId: text('opponent_id').notNull(),
    opponentName: text('opponent_name').notNull(),
    opponentMmr: real('opponent_mmr').notNull(),
    result: text('result').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.playerId, t.gameNum] }),
    uniqueIndex('game_num_per_player_idx').on(t.playerId, t.gameNum),
  ]
)

export const users = pgTable('user', (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({
      mode: 'date',
      withTimezone: true,
    })
    .default(sql`CURRENT_TIMESTAMP`),
  image: d.varchar({ length: 255 }),
  discord_id: d.varchar({ length: 255 }),
  role: d.varchar({ length: 255 }).notNull().default('user'),
}))

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}))

export const accounts = pgTable(
  'account',
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount['type']>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index('account_user_id_idx').on(t.userId),
  ]
)

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessions = pgTable(
  'session',
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: 'date', withTimezone: true }).notNull(),
  }),
  (t) => [index('t_user_id_idx').on(t.userId)]
)

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const verificationTokens = pgTable(
  'verification_token',
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: 'date', withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
)

// Table to store player Elo ratings for different game modes
export const player_ratings = pgTable(
  'player_ratings',
  {
    playerId: text('player_id').notNull(),
    gameMode: text('game_mode').notNull(),
    rating: real('rating').notNull().default(1000), // Default Elo rating
    gamesPlayed: integer('games_played').notNull().default(0),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    draws: integer('draws').notNull().default(0),
    lastPlayed: timestamp('last_played'),
    peakRating: real('peak_rating').notNull().default(1000),
  },
  (t) => [
    primaryKey({ columns: [t.playerId, t.gameMode] }),
    index('player_ratings_player_id_idx').on(t.playerId),
    index('player_ratings_game_mode_idx').on(t.gameMode),
  ]
)

export const player_ratingsRelations = relations(player_ratings, ({ one }) => ({
  user: one(users, { fields: [player_ratings.playerId], references: [users.id] }),
}))

// Table to store match queue entries
export const queue_entries = pgTable(
  'queue_entries',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    playerId: text('player_id').notNull().references(() => users.id),
    gameMode: text('game_mode').notNull(),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
    status: text('status').notNull().default('waiting'), // waiting, matched, cancelled
    matchId: integer('match_id'),
  },
  (t) => [
    index('queue_entries_player_id_idx').on(t.playerId),
    index('queue_entries_game_mode_idx').on(t.gameMode),
    index('queue_entries_status_idx').on(t.status),
  ]
)

export const queue_entriesRelations = relations(queue_entries, ({ one }) => ({
  user: one(users, { fields: [queue_entries.playerId], references: [users.id] }),
}))

// Table to store matches
export const matches = pgTable(
  'matches',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    gameMode: text('game_mode').notNull(),
    player1Id: text('player1_id').notNull().references(() => users.id),
    player2Id: text('player2_id').notNull().references(() => users.id),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
    winnerId: text('winner_id').references(() => users.id),
    status: text('status').notNull().default('in_progress'), // in_progress, completed, cancelled
    gameNumber: integer('game_number').notNull(),
  },
  (t) => [
    index('matches_player1_id_idx').on(t.player1Id),
    index('matches_player2_id_idx').on(t.player2Id),
    index('matches_game_mode_idx').on(t.gameMode),
    index('matches_status_idx').on(t.status),
  ]
)

export const matchesRelations = relations(matches, ({ one }) => ({
  player1: one(users, { fields: [matches.player1Id], references: [users.id] }),
  player2: one(users, { fields: [matches.player2Id], references: [users.id] }),
  winner: one(users, { fields: [matches.winnerId], references: [users.id] }),
}))
