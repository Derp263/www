import { createTRPCRouter, publicProcedure } from '@/server/api/trpc'
import { leaderboardService, type LeaderboardEntry } from '@/server/services/leaderboard'
import { z } from 'zod'

export const leaderboard_router = createTRPCRouter({
  get_leaderboard: publicProcedure
    .input(
      z.object({
        gameMode: z.string(),
      })
    )
    .query(async ({ input }) => {
      return await leaderboardService.getLeaderboard(input.gameMode)
    }),
  get_user_rank: publicProcedure
    .input(
      z.object({
        gameMode: z.string(),
        user_id: z.string(),
      })
    )
    .query(async ({ input }) => {
      return await leaderboardService.getUserRank(input.gameMode, input.user_id)
    }),
})
