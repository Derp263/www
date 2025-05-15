import { redis } from '../redis'
import { db } from '@/server/db'
import { player_ratings, users } from '@/server/db/schema'
import { eq, desc } from 'drizzle-orm'

export type LeaderboardEntry = {
  id: string
  name: string
  mmr: number
  wins: number
  losses: number
  draws: number
  streak?: number
  totalgames: number
  decay?: number
  ign?: any
  peak_mmr: number
  peak_streak?: number
  rank: number
  winrate: number
  gameMode: string
}

export class LeaderboardService {
  private getZSetKey(gameMode: string) {
    return `zset:leaderboard:${gameMode}`
  }

  private getRawKey(gameMode: string) {
    return `raw:leaderboard:${gameMode}`
  }

  private getUserKey(userId: string, gameMode: string) {
    return `user:${userId}:${gameMode}`
  }

  async refreshLeaderboard(gameMode: string) {
    try {
      // Get ratings from database
      const ratings = await db
        .select({
          rating: player_ratings,
          user: users,
        })
        .from(player_ratings)
        .where(eq(player_ratings.gameMode, gameMode))
        .innerJoin(users, eq(player_ratings.playerId, users.id))
        .orderBy(desc(player_ratings.rating))

      // Transform to leaderboard entries
      const leaderboard: LeaderboardEntry[] = ratings.map((entry, index) => {
        const totalgames = entry.rating.wins + entry.rating.losses + entry.rating.draws
        const winrate = totalgames > 0 ? entry.rating.wins / totalgames : 0

        return {
          id: entry.rating.playerId,
          name: entry.user.name || 'Unknown',
          mmr: entry.rating.rating,
          wins: entry.rating.wins,
          losses: entry.rating.losses,
          draws: entry.rating.draws,
          totalgames,
          peak_mmr: entry.rating.peakRating,
          rank: index + 1,
          winrate,
          gameMode: entry.rating.gameMode,
        }
      })

      // Cache in Redis
      const zsetKey = this.getZSetKey(gameMode)
      const rawKey = this.getRawKey(gameMode)

      const pipeline = redis.pipeline()
      pipeline.setex(rawKey, 180, JSON.stringify(leaderboard))
      pipeline.del(zsetKey)

      for (const entry of leaderboard) {
        pipeline.zadd(zsetKey, entry.mmr, entry.id)
        pipeline.hset(this.getUserKey(entry.id, gameMode), {
          ...entry,
        })
      }

      pipeline.expire(zsetKey, 180)
      await pipeline.exec()

      return leaderboard
    } catch (error) {
      console.error('Error refreshing leaderboard:', error)
      throw error
    }
  }

  async getLeaderboard(gameMode: string) {
    try {
      const cached = await redis.get(this.getRawKey(gameMode))
      if (cached) return JSON.parse(cached) as LeaderboardEntry[]

      return await this.refreshLeaderboard(gameMode)
    } catch (error) {
      console.error('Error getting leaderboard:', error)
      throw error
    }
  }

  async getUserRank(gameMode: string, userId: string) {
    try {
      const userData = await redis.hgetall(this.getUserKey(userId, gameMode))
      if (userData && Object.keys(userData).length > 0) {
        return {
          ...userData,
          mmr: Number(userData.mmr),
          wins: Number(userData.wins),
          losses: Number(userData.losses),
          draws: Number(userData.draws),
          totalgames: Number(userData.totalgames),
          peak_mmr: Number(userData.peak_mmr),
          rank: Number(userData.rank),
          winrate: Number(userData.winrate),
        } as unknown as LeaderboardEntry
      }

      // If not in cache, get from database
      const rating = await db
        .select({
          rating: player_ratings,
          user: users,
        })
        .from(player_ratings)
        .where(
          eq(player_ratings.playerId, userId),
          eq(player_ratings.gameMode, gameMode)
        )
        .innerJoin(users, eq(player_ratings.playerId, users.id))
        .limit(1)

      if (rating.length === 0) return null

      // Get rank
      const rank = await db
        .select({ count: player_ratings })
        .from(player_ratings)
        .where(eq(player_ratings.gameMode, gameMode))
        .where(`rating > (SELECT rating FROM player_ratings WHERE player_id = ? AND game_mode = ?)`, [userId, gameMode])
        .count()

      const entry = rating[0]
      const totalgames = entry.rating.wins + entry.rating.losses + entry.rating.draws
      const winrate = totalgames > 0 ? entry.rating.wins / totalgames : 0

      const leaderboardEntry: LeaderboardEntry = {
        id: entry.rating.playerId,
        name: entry.user.name || 'Unknown',
        mmr: entry.rating.rating,
        wins: entry.rating.wins,
        losses: entry.rating.losses,
        draws: entry.rating.draws,
        totalgames,
        peak_mmr: entry.rating.peakRating,
        rank: (rank[0]?.count as number || 0) + 1,
        winrate,
        gameMode: entry.rating.gameMode,
      }

      // Cache in Redis
      await redis.hset(this.getUserKey(userId, gameMode), {
        ...leaderboardEntry,
      })

      return leaderboardEntry
    } catch (error) {
      console.error('Error getting user rank:', error)
      throw error
    }
  }
}

export const leaderboardService = new LeaderboardService()