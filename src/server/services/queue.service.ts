import { globalEmitter } from '@/lib/events'
import type { PlayerState } from '@/server/api/routers/player-state'
import { db } from '@/server/db'
import {
  matches,
  player_ratings,
  queue_entries,
  users,
} from '@/server/db/schema'
import { redis } from '@/server/redis'
import { and, asc, desc, eq, isNull, not, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
const player1Table = alias(users, 'player1')
const player2Table = alias(users, 'player2')
const winnerTable = alias(users, 'winner')
const PLAYER_STATE_KEY = (userId: string) => `player:${userId}:state`

/**
 * Service for managing the match queue
 */
export class QueueService {
  /**
   * Add a player to the queue
   * @param playerId The player's ID
   * @param gameMode The game mode
   * @returns The queue entry
   */
  async joinQueue(playerId: string, gameMode: string) {
    // Check if player is already in queue
    const existingEntry = await db
      .select()
      .from(queue_entries)
      .where(
        and(
          eq(queue_entries.playerId, playerId),
          eq(queue_entries.status, 'waiting')
        )
      )
      .limit(1)

    if (existingEntry.length > 0) {
      return existingEntry[0]
    }

    // Add player to queue
    const [entry] = await db
      .insert(queue_entries)
      .values({
        playerId,
        gameMode,
        joinedAt: new Date(),
        status: 'waiting',
      })
      .returning()

    // Update player state
    const playerState: PlayerState = {
      status: 'queuing',
      queueStartTime: Date.now(),
    }
    await redis.set(PLAYER_STATE_KEY(playerId), JSON.stringify(playerState))
    globalEmitter.emit(`state-change:${playerId}`, playerState)

    // Try to match with another player
    await this.matchPlayers(gameMode)

    return entry
  }

  /**
   * Remove a player from the queue
   * @param playerId The player's ID
   * @returns True if the player was removed, false otherwise
   */
  async leaveQueue(playerId: string) {
    const [entry] = await db
      .update(queue_entries)
      .set({
        status: 'cancelled',
      })
      .where(
        and(
          eq(queue_entries.playerId, playerId),
          eq(queue_entries.status, 'waiting')
        )
      )
      .returning()

    if (!entry) {
      return false
    }

    // Update player state
    const playerState: PlayerState = {
      status: 'idle',
    }
    await redis.set(PLAYER_STATE_KEY(playerId), JSON.stringify(playerState))
    globalEmitter.emit(`state-change:${playerId}`, playerState)

    return true
  }

  /**
   * Try to match players in the queue
   * @param gameMode The game mode to match players for
   * @returns The match if one was created, null otherwise
   */
  async matchPlayers(gameMode: string) {
    // Get players in queue for this game mode
    const queuedPlayers = await db
      .select()
      .from(queue_entries)
      .where(
        and(
          eq(queue_entries.gameMode, gameMode),
          eq(queue_entries.status, 'waiting')
        )
      )
      .orderBy(asc(queue_entries.joinedAt))
      .limit(2)

    if (queuedPlayers.length < 2) {
      return null
    }

    const [player1, player2] = queuedPlayers

    // Create a match
    const [match] = await db
      .insert(matches)
      .values({
        gameMode,
        player1Id: player1.playerId,
        player2Id: player2.playerId,
        startedAt: new Date(),
        status: 'in_progress',
        gameNumber: await this.getNextGameNumber(),
      })
      .returning()

    // Update queue entries
    await db
      .update(queue_entries)
      .set({
        status: 'matched',
        matchId: match.id,
      })
      .where(
        or(eq(queue_entries.id, player1.id), eq(queue_entries.id, player2.id))
      )

    // Update player states
    const player1State: PlayerState = {
      status: 'in_game',
      currentMatch: {
        opponentId: player2.playerId,
        startTime: Date.now(),
      },
    }
    const player2State: PlayerState = {
      status: 'in_game',
      currentMatch: {
        opponentId: player1.playerId,
        startTime: Date.now(),
      },
    }

    await redis.set(
      PLAYER_STATE_KEY(player1.playerId),
      JSON.stringify(player1State)
    )
    await redis.set(
      PLAYER_STATE_KEY(player2.playerId),
      JSON.stringify(player2State)
    )

    globalEmitter.emit(`state-change:${player1.playerId}`, player1State)
    globalEmitter.emit(`state-change:${player2.playerId}`, player2State)

    return match
  }

  /**
   * Complete a match
   * @param matchId The match ID
   * @param winnerId The winner's ID, or null for a draw
   * @returns The updated match
   */
  async completeMatch(matchId: number, winnerId: string | null) {
    const [match] = await db
      .update(matches)
      .set({
        completedAt: new Date(),
        winnerId,
        status: 'completed',
      })
      .where(eq(matches.id, matchId))
      .returning()

    if (!match) {
      throw new Error(`Match ${matchId} not found`)
    }

    // Update player states
    const player1State: PlayerState = {
      status: 'idle',
    }
    const player2State: PlayerState = {
      status: 'idle',
    }

    await redis.set(
      PLAYER_STATE_KEY(match.player1Id),
      JSON.stringify(player1State)
    )
    await redis.set(
      PLAYER_STATE_KEY(match.player2Id),
      JSON.stringify(player2State)
    )

    globalEmitter.emit(`state-change:${match.player1Id}`, player1State)
    globalEmitter.emit(`state-change:${match.player2Id}`, player2State)

    // Update player ratings
    let result = 0.5 // Default to draw
    if (winnerId === match.player1Id) {
      result = 1 // Player 1 won
    } else if (winnerId === match.player2Id) {
      result = 0 // Player 2 won
    }

    // Update Elo ratings
    await this.updateRatings(
      match.player1Id,
      match.player2Id,
      match.gameMode,
      result
    )

    return match
  }

  /**
   * Get the next game number
   * @returns The next game number
   */
  private async getNextGameNumber() {
    const lastMatch = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.gameNumber))
      .limit(1)

    return lastMatch.length > 0 ? lastMatch[0].gameNumber + 1 : 1
  }

  /**
   * Update player ratings after a match
   * @param player1Id The ID of player 1
   * @param player2Id The ID of player 2
   * @param gameMode The game mode
   * @param result The result of the match (1 if player 1 won, 0.5 for draw, 0 if player 2 won)
   */
  private async updateRatings(
    player1Id: string,
    player2Id: string,
    gameMode: string,
    result: number
  ) {
    // Get player ratings
    const player1Rating = await this.getOrCreatePlayerRating(
      player1Id,
      gameMode
    )
    const player2Rating = await this.getOrCreatePlayerRating(
      player2Id,
      gameMode
    )

    // Calculate expected scores
    const player1Expected = this.calculateExpectedScore(
      player1Rating.rating,
      player2Rating.rating
    )
    const player2Expected = this.calculateExpectedScore(
      player2Rating.rating,
      player1Rating.rating
    )

    // Calculate new ratings
    const player1NewRating = this.calculateNewRating(
      player1Rating.rating,
      player1Expected,
      result,
      player1Rating.gamesPlayed
    )
    const player2NewRating = this.calculateNewRating(
      player2Rating.rating,
      player2Expected,
      1 - result,
      player2Rating.gamesPlayed
    )

    // Update player 1's rating
    await db
      .update(player_ratings)
      .set({
        rating: player1NewRating,
        gamesPlayed: player1Rating.gamesPlayed + 1,
        wins: result === 1 ? player1Rating.wins + 1 : player1Rating.wins,
        losses: result === 0 ? player1Rating.losses + 1 : player1Rating.losses,
        draws: result === 0.5 ? player1Rating.draws + 1 : player1Rating.draws,
        lastPlayed: new Date(),
        peakRating: Math.max(player1Rating.peakRating, player1NewRating),
      })
      .where(
        and(
          eq(player_ratings.playerId, player1Id),
          eq(player_ratings.gameMode, gameMode)
        )
      )

    // Update player 2's rating
    await db
      .update(player_ratings)
      .set({
        rating: player2NewRating,
        gamesPlayed: player2Rating.gamesPlayed + 1,
        wins: result === 0 ? player2Rating.wins + 1 : player2Rating.wins,
        losses: result === 1 ? player2Rating.losses + 1 : player2Rating.losses,
        draws: result === 0.5 ? player2Rating.draws + 1 : player2Rating.draws,
        lastPlayed: new Date(),
        peakRating: Math.max(player2Rating.peakRating, player2NewRating),
      })
      .where(
        and(
          eq(player_ratings.playerId, player2Id),
          eq(player_ratings.gameMode, gameMode)
        )
      )

    return {
      player1NewRating,
      player2NewRating,
    }
  }

  /**
   * Get a player's rating for a specific game mode
   * @param playerId The player's ID
   * @param gameMode The game mode
   * @returns The player's rating data, or null if not found
   */
  private async getPlayerRating(playerId: string, gameMode: string) {
    const ratings = await db
      .select()
      .from(player_ratings)
      .where(
        and(
          eq(player_ratings.playerId, playerId),
          eq(player_ratings.gameMode, gameMode)
        )
      )
      .limit(1)

    return ratings.length > 0 ? ratings[0] : null
  }

  /**
   * Get or create a player's rating for a specific game mode
   * @param playerId The player's ID
   * @param gameMode The game mode
   * @returns The player's rating data
   */
  private async getOrCreatePlayerRating(playerId: string, gameMode: string) {
    const rating = await this.getPlayerRating(playerId, gameMode)

    if (rating) {
      return rating
    }

    // Create a new rating entry with default values
    const newRating = {
      playerId,
      gameMode,
      rating: 1000,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      lastPlayed: new Date(),
      peakRating: 1000,
    }

    await db.insert(player_ratings).values(newRating)
    return newRating
  }

  /**
   * Calculate the expected score for a player based on their rating and their opponent's rating
   * @param playerRating The player's current Elo rating
   * @param opponentRating The opponent's current Elo rating
   * @returns A number between 0 and 1 representing the expected score
   */
  private calculateExpectedScore(
    playerRating: number,
    opponentRating: number
  ): number {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
  }

  /**
   * Calculate the new Elo rating for a player based on their current rating, expected score, and actual score
   * @param currentRating The player's current Elo rating
   * @param expectedScore The expected score calculated from the ratings
   * @param actualScore The actual score (1 for win, 0.5 for draw, 0 for loss)
   * @param gamesPlayed The number of games the player has played
   * @returns The new Elo rating
   */
  private calculateNewRating(
    currentRating: number,
    expectedScore: number,
    actualScore: number,
    gamesPlayed: number
  ): number {
    // Constants for Elo calculation
    const K_FACTOR = 32 // Standard K-factor for Elo calculations
    const PROVISIONAL_K_FACTOR = 64 // Higher K-factor for players with few games
    const PROVISIONAL_THRESHOLD = 10 // Number of games before a player is no longer provisional

    // Use a higher K-factor for players with few games
    const kFactor =
      gamesPlayed < PROVISIONAL_THRESHOLD ? PROVISIONAL_K_FACTOR : K_FACTOR
    return Math.round(currentRating + kFactor * (actualScore - expectedScore))
  }

  /**
   * Get all active matches
   * @returns An array of active matches
   */
  async getActiveMatches() {
    return db
      .select({
        match: matches,
        player1: player1Table,
        player2: player2Table,
      })
      .from(matches)
      .where(eq(matches.status, 'in_progress'))
      .innerJoin(player1Table, eq(matches.player1Id, player1Table.id))
      .innerJoin(player2Table, eq(matches.player2Id, player2Table.id))
      .orderBy(desc(matches.startedAt))
  }

  /**
   * Get all matches for a player
   * @param playerId The player's ID
   * @returns An array of matches
   */
  async getPlayerMatches(playerId: string) {
    return db
      .select()
      .from(matches)
      .where(
        or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId))
      )
      .orderBy(desc(matches.startedAt))
  }
  /**
   * Get all players in the queue
   * @returns An array of queue entries with player information
   */
  async getQueueEntries() {
    return db
      .select({
        entry: queue_entries,
        player: users,
      })
      .from(queue_entries)
      .where(eq(queue_entries.status, 'waiting'))
      .innerJoin(users, eq(queue_entries.playerId, users.id))
      .orderBy(asc(queue_entries.joinedAt))
  }

  /**
   * Get a match by ID
   * @param matchId The match ID
   * @returns The match, or null if not found
   */
  async getMatch(matchId: number) {
    const res = await db
      .select({
        match: matches,
        player1: player1Table,
        player2: player2Table,
        winner: winnerTable,
      })
      .from(matches)
      .where(eq(matches.id, matchId))
      .leftJoin(player1Table, eq(matches.player1Id, player1Table.id))
      .leftJoin(player2Table, eq(matches.player2Id, player2Table.id))
      .leftJoin(winnerTable, eq(matches.winnerId, winnerTable.id))
      .limit(1)

    return res.length > 0 ? res[0] : null
  }
}

export const queueService = new QueueService()
