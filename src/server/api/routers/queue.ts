import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'
import { queueService } from '@/server/services/queue.service'
import { GameMode } from '@/server/db/schema'
import { TRPCError } from '@trpc/server'

export const queueRouter = createTRPCRouter({
  // Join the queue
  joinQueue: protectedProcedure
    .input(
      z.object({
        gameMode: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      return queueService.joinQueue(userId, input.gameMode)
    }),

  // Leave the queue
  leaveQueue: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return queueService.leaveQueue(userId)
  }),

  // Get all players in the queue
  getQueueEntries: publicProcedure.query(async () => {
    return queueService.getQueueEntries()
  }),

  // Get all active matches
  getActiveMatches: publicProcedure.query(async () => {
    return queueService.getActiveMatches()
  }),

  // Get all matches for the current user
  getUserMatches: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return queueService.getPlayerMatches(userId)
  }),

  // Get a match by ID
  getMatch: publicProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const match = await queueService.getMatch(input)
      if (!match) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Match not found',
        })
      }
      return match
    }),

  // Complete a match (admin only)
  completeMatch: protectedProcedure
    .input(
      z.object({
        matchId: z.number(),
        winnerId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin
      if (ctx.session.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can complete matches',
        })
      }

      return queueService.completeMatch(input.matchId, input.winnerId)
    }),

  // Get supported game modes
  getGameModes: publicProcedure.query(() => {
    return Object.values(GameMode)
  }),
})