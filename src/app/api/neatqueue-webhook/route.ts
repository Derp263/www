import crypto from 'node:crypto'
import { globalEmitter } from '@/lib/events'
import { syncHistory } from '@/server/api/routers/history'
import type { PlayerState } from '@/server/api/routers/player-state'
import { PLAYER_STATE_KEY, redis } from '@/server/redis'
import { leaderboardService } from '@/server/services/leaderboard'
import { RANKED_QUEUE_ID, VANILLA_QUEUE_ID } from '@/shared/constants'
import { type NextRequest, NextResponse } from 'next/server'

const EXPECTED_QUERY_SECRET = process.env.WEBHOOK_QUERY_SECRET
const QUERY_PARAM_NAME = 'token'

/**
 * Verifies the secret from the query parameter.
 */
function verifyQuerySecret(req: NextRequest): boolean {
  if (!EXPECTED_QUERY_SECRET) {
    console.error(
      'Webhook query secret is not configured in environment variables.'
    )
    return false
  }

  const providedSecret = req.nextUrl.searchParams.get(QUERY_PARAM_NAME)

  if (!providedSecret) {
    console.warn(`Query parameter "${QUERY_PARAM_NAME}" missing.`)
    return false
  }

  const expectedBuffer = Buffer.from(EXPECTED_QUERY_SECRET, 'utf8')
  const providedBuffer = Buffer.from(providedSecret, 'utf8')

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    console.warn('Invalid query secret provided.')
    return false
  }

  console.log('Query secret verified successfully.')
  return true
}

/**
 * Handles POST requests to the /api/webhooks endpoint.
 * Verifies query secret, logs payload, and handles actions.
 */
export async function POST(req: NextRequest) {
  try {
    const isVerified = verifyQuerySecret(req)
    if (!isVerified) {
      console.log('Webhook verification failed (query secret).')
      return NextResponse.json(
        { message: 'Unauthorized: Invalid or missing secret' },
        { status: 401 }
      )
    }

    const payload = await req.json()

    switch (payload.action) {
      case 'JOIN_QUEUE': {
        const state: PlayerState = {
          status: 'queuing',
          queueStartTime: Date.now(),
        }
        const userId = payload.new_players[0].id
        console.log('-----JOIN QUEUE-----')
        console.dir(payload, { depth: null })
        console.log(userId)
        await redis.set(PLAYER_STATE_KEY(userId), JSON.stringify(state))
        globalEmitter.emit(`state-change:${userId}`, state)
        break
      }

      case 'MATCH_STARTED': {
        const playerIds = payload.players.map((p: any) => p.id) as string[]

        await Promise.all(
          playerIds.map(async (id) => {
            const state = {
              status: 'in_game',
              currentMatch: {
                opponentId: playerIds.find((p) => p !== id),
                startTime: Date.now(),
              },
            }
            await redis.set(PLAYER_STATE_KEY(id), JSON.stringify(state))
            globalEmitter.emit(`state-change:${id}`, state)
          })
        )
        break
      }

      case 'MATCH_COMPLETED': {
        const playerIds = payload.teams.map((p: any) => p[0].id) as string[]
        console.log({ playerIds })
        await syncHistory()
        await Promise.allSettled(
          [RANKED_QUEUE_ID].map((id) =>
            leaderboardService.refreshLeaderboard(id)
          )
        )
        await Promise.all(
          playerIds.map(async (id) => {
            await redis.del(PLAYER_STATE_KEY(id))
            globalEmitter.emit(`state-change:${id}`, { status: 'idle' })
          })
        ).catch(console.error)

        break
      }

      case 'LEAVE_QUEUE': {
        const userId = payload.players_removed[0].id
        await redis.del(PLAYER_STATE_KEY(userId))
        globalEmitter.emit(`state-change:${userId}`, { status: 'idle' })
        break
      }
    }

    console.log(
      '--- Verified Webhook Received (Query Auth) ---',
      new Date().toISOString(),
      '---\n',
      JSON.stringify(payload, null, 2),
      '\n--- End Webhook ---'
    )

    console.log(
      `Action: ${payload?.action || 'Unknown'}. Sending generic success response.`
    )
    return NextResponse.json(
      { message: 'Webhook received successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('!!! Error processing webhook:', error)
    try {
      // Attempt to read body on error
      const errorBody = await req.clone().text()
      console.error('Raw request body on error:', errorBody)
    } catch (bodyError) {
      console.error('Could not read raw request body on error:', bodyError)
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { message: 'Invalid JSON payload' },
        { status: 400 }
      )
    }
    if (error.message.includes('Webhook query secret is not configured')) {
      return NextResponse.json(
        { message: 'Internal Server Error: Webhook secret not configured' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Internal Server Error processing webhook' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { message: 'Method Not Allowed. Please use POST.' },
    { status: 405 }
  )
}
