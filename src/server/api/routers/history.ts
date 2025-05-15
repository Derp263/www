import { createTRPCRouter, publicProcedure } from '@/server/api/trpc'
import { db } from '@/server/db'
import { GameMode, metadata, player_games, raw_history } from '@/server/db/schema'
import { desc, eq } from 'drizzle-orm'
import ky from 'ky'
import { chunk } from 'remeda'
import { z } from 'zod'
import * as eloService from '@/server/services/elo.service'

export const history_router = createTRPCRouter({
  user_games: publicProcedure
    .input(
      z.object({
        user_id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(player_games)
        .where(eq(player_games.playerId, input.user_id))
        .orderBy(desc(player_games.gameNum))
    }),
  sync: publicProcedure.mutation(async () => {
    return syncHistory()
  }),
})

export async function syncHistory() {
  // This function is no longer needed as we're storing match history directly
  // in our own database. It's kept as a placeholder for backward compatibility.
  console.log('syncHistory is deprecated - match history is now stored directly in our database')
  return { message: 'Match history is now stored directly in our database' }
}

function processGameEntry(gameId: number, game_num: number, entry: any) {
  const parsedEntry = typeof entry === 'string' ? JSON.parse(entry) : entry
  if (parsedEntry.game === '1v1-attrition') {
    return []
  }
  if (!parsedEntry.teams?.[0]?.[0] || !parsedEntry.teams?.[1]?.[0]) {
    console.log('skipping game', parsedEntry)
    return []
  }

  if (parsedEntry.winner === -2) {
    console.log('skipping ongoing game', parsedEntry)
    return []
  }
  const player0 = parsedEntry.teams[0][0]
  const player1 = parsedEntry.teams[1][0]
  let p0result = null
  let p1result = null

  if (parsedEntry.winner === 2) {
    p0result = 'tie'
    p1result = 'tie'
  } else if (parsedEntry.winner === 0) {
    p0result = 'win'
    p1result = 'loss'
  } else if (parsedEntry.winner === 1) {
    p0result = 'loss'
    p1result = 'win'
  } else {
    p0result = 'unknown'
    p1result = 'unknown'
  }
  return [
    {
      gameId,
      gameNum: game_num,
      gameTime: new Date(parsedEntry.time),
      gameType: parsedEntry.game,
      mmrChange: Number.parseFloat(player0.mmr_change),
      opponentId: player1.id,
      opponentMmr: Number.parseFloat(player1.mmr),
      opponentName: player1.name,
      playerId: player0.id,
      playerMmr: Number.parseFloat(player0.mmr),
      playerName: player0.name,
      result: p0result,
      won: parsedEntry.winner === 0,
    },
    {
      gameId,
      gameNum: game_num,
      gameTime: new Date(parsedEntry.time),
      gameType: parsedEntry.game,
      mmrChange: Number.parseFloat(player1.mmr_change),
      opponentId: player0.id,
      opponentMmr: Number.parseFloat(player0.mmr),
      opponentName: player0.name,
      playerId: player1.id,
      playerMmr: Number.parseFloat(player1.mmr),
      playerName: player1.name,
      result: p1result,
      won: parsedEntry.winner === 1,
    },
  ]
}
export async function insertGameHistory(entries: any[]) {
  const rawResults = await Promise.all(
    entries.map(async (entry) => {
      return db
        .insert(raw_history)
        .values({ entry, game_num: entry.game_num })
        .returning()
        .onConflictDoUpdate({
          target: raw_history.game_num,
          set: {
            entry,
          },
        })
        .then((res) => res[0])
    })
  ).then((res) => res.filter(Boolean))

  const playerGameRows = rawResults.flatMap(({ entry, id, game_num }: any) => {
    return processGameEntry(id, game_num, entry)
  })

  // Group games by game number to process pairs together
  const gamesByNumber: Record<number, any[]> = {}
  playerGameRows.forEach(row => {
    if (!gamesByNumber[row.gameNum]) {
      gamesByNumber[row.gameNum] = []
    }
    gamesByNumber[row.gameNum].push(row)
  })

  // Process each game
  await Promise.all(
    Object.values(gamesByNumber).map(async (gameRows) => {
      // Skip if we don't have exactly 2 players
      if (gameRows.length !== 2) {
        console.log('Skipping game with != 2 players:', gameRows.length)
        return
      }

      // Insert game records
      await Promise.all(
        gameRows.map(async (row) => {
          return db
            .insert(player_games)
            .values(row)
            .onConflictDoUpdate({
              target: [player_games.playerId, player_games.gameNum],
              set: row,
            })
            .then((res) => res[0])
        })
      )

      // Update Elo ratings
      const [player1, player2] = gameRows

      // Map game type to our GameMode enum
      let gameMode: string
      switch (player1.gameType.toLowerCase()) {
        case 'vanilla':
          gameMode = GameMode.VANILLA
          break
        case 'standard':
        case 'ranked':
          gameMode = GameMode.STANDARD
          break
        case 'badlatro':
          gameMode = GameMode.BADLATRO
          break
        default:
          // Default to standard for unknown game types
          gameMode = GameMode.STANDARD
      }

      // Determine result for Elo calculation (1 for player1 win, 0.5 for draw, 0 for player2 win)
      let eloResult: number
      if (player1.result === 'win' && player2.result === 'loss') {
        eloResult = 1
      } else if (player1.result === 'loss' && player2.result === 'win') {
        eloResult = 0
      } else if (player1.result === 'tie' && player2.result === 'tie') {
        eloResult = 0.5
      } else {
        // Skip games with unknown results
        console.log('Skipping game with unknown result:', player1.result, player2.result)
        return
      }

      // Update Elo ratings
      await eloService.updateRatings(
        player1.playerId,
        player2.playerId,
        gameMode,
        eloResult
      )
    })
  )
}
