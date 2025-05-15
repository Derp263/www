import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'
import { GameMode, player_ratings } from '@/server/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import * as eloService from '@/server/services/elo.service'

export const ratingsRouter = createTRPCRouter({
  // Get a player's rating for a specific game mode
  getPlayerRating: publicProcedure
    .input(
      z.object({
        playerId: z.string(),
        gameMode: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return eloService.getPlayerRating(input.playerId, input.gameMode)
    }),

  // Get all ratings for a player
  getPlayerRatings: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input: playerId }) => {
      return ctx.db
        .select()
        .from(player_ratings)
        .where(eq(player_ratings.playerId, playerId))
    }),

  // Get leaderboard for a specific game mode
  getLeaderboard: publicProcedure
    .input(
      z.object({
        gameMode: z.string(),
        limit: z.number().optional().default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(player_ratings)
        .where(eq(player_ratings.gameMode, input.gameMode))
        .orderBy(desc(player_ratings.rating))
        .limit(input.limit)
    }),

  // Update ratings after a match
  updateRatings: publicProcedure
    .input(
      z.object({
        player1Id: z.string(),
        player2Id: z.string(),
        gameMode: z.string(),
        result: z.number(), // 1 for player1 win, 0.5 for draw, 0 for player2 win
      })
    )
    .mutation(async ({ input }) => {
      return eloService.updateRatings(
        input.player1Id,
        input.player2Id,
        input.gameMode,
        input.result
      )
    }),

  // Get supported game modes
  getGameModes: publicProcedure.query(() => {
    return Object.values(GameMode)
  }),
})