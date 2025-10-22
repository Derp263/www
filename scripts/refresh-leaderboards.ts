import { LeaderboardService } from '@/server/services/leaderboard'
import { RANKED_QUEUE_ID, VANILLA_QUEUE_ID } from '@/shared/constants'

const CHANNEL_IDS = [RANKED_QUEUE_ID, VANILLA_QUEUE_ID]

async function refresh() {
  const service = new LeaderboardService()

  for (const channelId of CHANNEL_IDS) {
    try {
      console.log(`refreshing leaderboard for ${channelId}...`)
      await service.refreshLeaderboard(channelId)
    } catch (err) {
      console.error(`failed to refresh ${channelId}:`, err)
    }
  }
}

// run if called directly
if (require.main === module) {
  refresh()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('refresh failed:', err)
      process.exit(1)
    })
}
