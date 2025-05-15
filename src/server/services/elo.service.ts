import { db } from '@/server/db'
import { player_ratings } from '@/server/db/schema'
import { eq, and } from 'drizzle-orm'

// Constants for Elo calculation
const K_FACTOR = 32 // Standard K-factor for Elo calculations
const PROVISIONAL_K_FACTOR = 64 // Higher K-factor for players with few games
const PROVISIONAL_THRESHOLD = 10 // Number of games before a player is no longer provisional

/**
 * Calculate the expected score for a player based on their rating and their opponent's rating
 * @param playerRating The player's current Elo rating
 * @param opponentRating The opponent's current Elo rating
 * @returns A number between 0 and 1 representing the expected score
 */
export function calculateExpectedScore(playerRating: number, opponentRating: number): number {
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
export function calculateNewRating(
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  gamesPlayed: number
): number {
  // Use a higher K-factor for players with few games
  const kFactor = gamesPlayed < PROVISIONAL_THRESHOLD ? PROVISIONAL_K_FACTOR : K_FACTOR
  return Math.round(currentRating + kFactor * (actualScore - expectedScore))
}

/**
 * Get a player's rating for a specific game mode
 * @param playerId The player's ID
 * @param gameMode The game mode
 * @returns The player's rating data, or null if not found
 */
export async function getPlayerRating(playerId: string, gameMode: string) {
  const ratings = await db
    .select()
    .from(player_ratings)
    .where(and(eq(player_ratings.playerId, playerId), eq(player_ratings.gameMode, gameMode)))
    .limit(1)

  return ratings.length > 0 ? ratings[0] : null
}

/**
 * Get or create a player's rating for a specific game mode
 * @param playerId The player's ID
 * @param gameMode The game mode
 * @returns The player's rating data
 */
export async function getOrCreatePlayerRating(playerId: string, gameMode: string) {
  const rating = await getPlayerRating(playerId, gameMode)
  
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
 * Update player ratings after a match
 * @param player1Id The ID of player 1
 * @param player2Id The ID of player 2
 * @param gameMode The game mode
 * @param result The result of the match (1 if player 1 won, 0.5 for draw, 0 if player 2 won)
 * @returns An object containing the updated ratings
 */
export async function updateRatings(
  player1Id: string,
  player2Id: string,
  gameMode: string,
  result: number
): Promise<{ player1NewRating: number; player2NewRating: number }> {
  // Get or create ratings for both players
  const player1Rating = await getOrCreatePlayerRating(player1Id, gameMode)
  const player2Rating = await getOrCreatePlayerRating(player2Id, gameMode)
  
  // Calculate expected scores
  const player1Expected = calculateExpectedScore(player1Rating.rating, player2Rating.rating)
  const player2Expected = calculateExpectedScore(player2Rating.rating, player1Rating.rating)
  
  // Calculate new ratings
  const player1NewRating = calculateNewRating(
    player1Rating.rating,
    player1Expected,
    result,
    player1Rating.gamesPlayed
  )
  const player2NewRating = calculateNewRating(
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
    .where(and(eq(player_ratings.playerId, player1Id), eq(player_ratings.gameMode, gameMode)))
  
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
    .where(and(eq(player_ratings.playerId, player2Id), eq(player_ratings.gameMode, gameMode)))
  
  return {
    player1NewRating,
    player2NewRating,
  }
}

/**
 * Get the leaderboard for a specific game mode
 * @param gameMode The game mode
 * @param limit The maximum number of players to return
 * @returns An array of player ratings sorted by rating
 */
export async function getLeaderboard(gameMode: string, limit: number = 100) {
  return db
    .select()
    .from(player_ratings)
    .where(eq(player_ratings.gameMode, gameMode))
    .orderBy(player_ratings.rating)
    .limit(limit)
}