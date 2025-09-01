'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/mobile-tooltip'
import type React from 'react'
import { useState } from 'react'

import { GamesTable } from '@/app/(home)/players/[id]/_components/games-table'
import { MmrTrendChart } from '@/app/(home)/players/[id]/_components/mmr-trend-chart'
import { OpponentsTable } from '@/app/(home)/players/[id]/_components/opponents-table'
import { WinrateTrendChart } from '@/app/(home)/players/[id]/_components/winrate-trend-chart'
import { TimeZoneProvider } from '@/components/timezone-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  RANKED_CHANNEL,
  SMALLWORLD_CHANNEL,
  VANILLA_CHANNEL,
} from '@/shared/constants'
import {
  type Season,
  filterGamesBySeason,
  getSeasonDisplayName,
} from '@/shared/seasons'
import { api } from '@/trpc/react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Filter,
  GlobeIcon,
  IceCreamCone,
  ShieldHalf,
  Star,
  Trophy,
  Twitch,
  UserIcon,
  Youtube,
} from 'lucide-react'
import { useFormatter, useTimeZone } from 'next-intl'
import { useParams } from 'next/navigation'
import { isNonNullish } from 'remeda'

const numberFormatter = new Intl.NumberFormat('en-US', {
  signDisplay: 'exceptZero',
})

export function UserInfo() {
  return (
    <TimeZoneProvider>
      <UserInfoComponent />
    </TimeZoneProvider>
  )
}
function unescapeName(str: string) {
  return str.replaceAll('\\', '')
}
function UserInfoComponent() {
  const [filter, setFilter] = useState('all')
  const format = useFormatter()
  const timeZone = useTimeZone()
  const [season, setSeason] = useState<Season>('season4')

  const [leaderboardFilter, setLeaderboardFilter] = useState('all')
  const { id } = useParams()
  if (!id || typeof id !== 'string') return null

  // Fetch games data unconditionally
  const gamesQuery = api.history.user_games.useSuspenseQuery({ user_id: id })
  const games = gamesQuery[0] || [] // Ensure games is always an array
  const [discord_user] = api.discord.get_user_by_id.useSuspenseQuery({
    user_id: id,
  })

  // Fetch current season data
  const [rankedLeaderboard] = api.leaderboard.get_leaderboard.useSuspenseQuery({
    channel_id: RANKED_CHANNEL,
    season,
  })

  const [vanillaLeaderboard] = api.leaderboard.get_leaderboard.useSuspenseQuery(
    {
      channel_id: VANILLA_CHANNEL,
      season,
    }
  )

  // Fetch current season user rank
  const [vanillaUserRankQ] = api.leaderboard.get_user_rank.useSuspenseQuery({
    channel_id: VANILLA_CHANNEL,
    user_id: id,
    season,
  })
  const [smallWorldUserRankQ] = api.leaderboard.get_user_rank.useSuspenseQuery({
    channel_id: SMALLWORLD_CHANNEL,
    user_id: id,
    season,
  })
  const [rankedUserRankQ] = api.leaderboard.get_user_rank.useSuspenseQuery({
    channel_id: RANKED_CHANNEL,
    user_id: id,
    season,
  })

  // Fetch Season 2 data for historic comparison
  const [rankedUserRankS2Q] = api.leaderboard.get_user_rank.useSuspenseQuery({
    channel_id: RANKED_CHANNEL,
    user_id: id,
    season: 'season2',
  })

  // Fetch Season 3 data for historic comparison
  const [rankedUserRankS3Q] = api.leaderboard.get_user_rank.useSuspenseQuery({
    channel_id: RANKED_CHANNEL,
    user_id: id,
    season: 'season3',
  })
  const rankedUserRank = rankedUserRankQ?.data
  const vanillaUserRank = vanillaUserRankQ?.data
  const smallWorldUserRank = smallWorldUserRankQ?.data

  // Extract historic data
  const rankedUserRankS2 = rankedUserRankS2Q?.data
  const rankedUserRankS3 = rankedUserRankS3Q?.data

  // Determine which historic data to show (opposite of current season)
  const historicRankedData =
    season === 'season2'
      ? rankedUserRankS3
      : season === 'season3'
        ? rankedUserRankS2
        : rankedUserRankS3
  // Filter games by season
  const seasonFilteredGames = filterGamesBySeason(games, season)

  const filteredGamesByLeaderboard =
    leaderboardFilter === 'all'
      ? seasonFilteredGames
      : seasonFilteredGames.filter(
          (game) =>
            game.gameType.toLowerCase() === leaderboardFilter?.toLowerCase()
        )

  // Filter by result
  const filteredGames =
    filter === 'all'
      ? filteredGamesByLeaderboard
      : filter === 'wins'
        ? filteredGamesByLeaderboard.filter((game) => game.result === 'win')
        : filter === 'losses'
          ? filteredGamesByLeaderboard.filter((game) => game.result === 'loss')
          : filter === 'wins-and-losses'
            ? filteredGamesByLeaderboard.filter(
                (game) => game.result === 'win' || game.result === 'loss'
              )
            : filteredGamesByLeaderboard.filter((game) => game.result === 'tie')

  const games_played = seasonFilteredGames.length
  let wins = 0
  let losses = 0
  let ties = 0
  for (const game of seasonFilteredGames) {
    if (game.result === 'win') {
      wins++
    } else if (game.result === 'loss') {
      losses++
    } else if (game.result === 'tie' || game.result === 'unknown') {
      ties++
    } else {
      ties++
    }
  }

  const aliases = [...new Set(seasonFilteredGames.map((g) => g.playerName))]
  const lastGame = seasonFilteredGames.at(0)

  const currentName = lastGame?.playerName ?? discord_user.username
  const meaningful_games = games_played - ties
  const profileData = {
    username: unescapeName(currentName),
    avatar: discord_user.avatar_url,
    games: games_played,
    meaningful_games,
    wins,
    losses,
    ties,
    winRate:
      meaningful_games > 0 ? Math.ceil((wins / meaningful_games) * 100) : 0,
    lossRate:
      meaningful_games > 0 ? Math.floor((losses / meaningful_games) * 100) : 0,
  }

  // Get the overall first game (not filtered by season)
  const overallFirstGame = games.at(-1)

  // Get last games for each leaderboard
  const lastRankedGame = seasonFilteredGames
    .filter((game) => game.gameType === 'ranked')
    .at(0)
  const lastVanillaGame = seasonFilteredGames
    .filter((game) => game.gameType.toLowerCase() === 'vanilla')
    .at(0)
  const lastSmallworldGame = seasonFilteredGames
    .filter((game) => game.gameType.toLowerCase() === 'smallworld')
    .at(0)

  // Calculate average opponent MMR for meaningful games
  const rankedMeaningfulGames = seasonFilteredGames.filter(
    (g) =>
      g.result !== 'tie' && g.result !== 'unknown' && g.gameType === 'ranked'
  )

  const avgOpponentMmr =
    rankedMeaningfulGames.length > 0
      ? rankedMeaningfulGames.reduce((acc, g) => acc + g.opponentMmr, 0) /
        rankedMeaningfulGames.length
      : 0
  return (
    <div className='flex flex-1 flex-col overflow-hidden'>
      <div className='mx-auto flex w-[calc(100%-1rem)] max-w-fd-container flex-1 flex-col'>
        <div className='py-8'>
          <div className='flex flex-col items-center gap-6 md:flex-row'>
            <div className='relative'>
              <Avatar className='size-24'>
                <AvatarImage
                  src={profileData.avatar}
                  alt={profileData.username}
                />
                <AvatarFallback className='bg-violet-50 font-bold text-2xl text-violet-600 dark:bg-violet-900/30 dark:text-violet-300'>
                  {profileData.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className='text-center md:text-left'>
              <div className={'flex items-start gap-2'}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <h1 className='font-bold text-3xl text-gray-900 underline decoration-auto decoration-dotted underline-offset-6 dark:text-white'>
                        {profileData.username}
                      </h1>
                    </TooltipTrigger>
                    <TooltipContent align={'center'} sideOffset={5}>
                      <div>
                        <p>Also known as:</p>
                        <ul className={'list-disc pl-4'}>
                          {aliases.map((alias) => (
                            <li key={alias}>{unescapeName(alias)}</li>
                          ))}
                        </ul>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <p className='pt-2 text-gray-500 text-sm dark:text-zinc-400'>
                {overallFirstGame ? (
                  <>
                    First game:{' '}
                    {format.dateTime(overallFirstGame.gameTime, {
                      dateStyle: 'long',
                      timeZone,
                    })}
                  </>
                ) : (
                  <>No games played yet</>
                )}
              </p>
              <div className='mt-2 flex flex-wrap items-center justify-center gap-2 md:justify-start'>
                {!!rankedLeaderboard && (
                  <Badge
                    variant='outline'
                    className='border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800'
                  >
                    <Trophy className='mr-1 h-3 w-3 text-violet-500' />
                    <span className='text-gray-700 dark:text-zinc-300'>
                      Ranked Queue:{' '}
                      {isNonNullish(rankedUserRank?.rank)
                        ? `#${rankedUserRank.rank}`
                        : 'N/A'}
                    </span>
                  </Badge>
                )}

                {/* Show historic rank data if available */}
                {historicRankedData && season !== 'all' && (
                  <Badge
                    variant='outline'
                    className='border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  >
                    <Calendar className='mr-1 h-3 w-3' />
                    <span>
                      {season === 'season3' ? 'Season 2' : 'Season 3'} Rank:{' '}
                      {isNonNullish(historicRankedData.rank)
                        ? `#${historicRankedData.rank}`
                        : 'N/A'}
                      {isNonNullish(historicRankedData.mmr)
                        ? ` (${Math.round(historicRankedData.mmr)} MMR)`
                        : ''}
                    </span>
                  </Badge>
                )}
                {!!vanillaLeaderboard && (
                  <Badge
                    variant='outline'
                    className='border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800'
                  >
                    <Trophy className='mr-1 h-3 w-3 text-violet-500' />
                    <span className='text-gray-700 dark:text-zinc-300'>
                      Vanilla Queue:{' '}
                      {isNonNullish(vanillaUserRank?.rank)
                        ? `#${vanillaUserRank.rank}`
                        : 'N/A'}
                    </span>
                  </Badge>
                )}
                {discord_user.twitch_url && (
                  <Badge
                    variant='outline'
                    className='border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800'
                  >
                    <Twitch className='mr-1 h-3 w-3 text-purple-500' />
                    <a
                      href={discord_user.twitch_url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-gray-700 hover:underline dark:text-zinc-300'
                    >
                      Twitch
                    </a>
                  </Badge>
                )}
                {discord_user.youtube_url && (
                  <Badge
                    variant='outline'
                    className='border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800'
                  >
                    <Youtube className='mr-1 h-3 w-3 text-red-500' />
                    <a
                      href={discord_user.youtube_url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-gray-700 hover:underline dark:text-zinc-300'
                    >
                      YouTube
                    </a>
                  </Badge>
                )}
              </div>
            </div>
            <div
              className={cn(
                'grid w-full flex-grow grid-cols-2 divide-gray-100 md:w-auto md:grid-cols-3 md:divide-y-0 dark:divide-zinc-800',
                isNonNullish(rankedUserRank?.mmr) && 'lg:grid-cols-5',
                isNonNullish(vanillaUserRank?.mmr) && 'lg:grid-cols-5',
                isNonNullish(rankedUserRank?.mmr) &&
                  isNonNullish(vanillaUserRank?.mmr) &&
                  'lg:grid-cols-6'
              )}
            >
              <StatsCard
                title='Games'
                value={profileData.meaningful_games}
                icon={<BarChart3 className='h-5 w-5 text-violet-500' />}
                description='Total matches'
              />
              <StatsCard
                title='Wins'
                value={profileData.wins}
                icon={<ArrowUpCircle className='h-5 w-5 text-emerald-500' />}
                description={`${profileData.winRate}% win rate`}
                accentColor='text-emerald-500'
              />
              <StatsCard
                title='Losses'
                value={profileData.losses}
                icon={<ArrowDownCircle className='h-5 w-5 text-rose-500' />}
                description={`${profileData.lossRate}% loss rate`}
                accentColor='text-rose-500'
              />

              {isNonNullish(rankedUserRank?.mmr) && (
                <StatsCard
                  title='Ranked MMR'
                  value={Math.round(rankedUserRank.mmr)}
                  description={
                    lastRankedGame ? (
                      <span
                        className={cn(
                          'flex items-center',
                          lastRankedGame.mmrChange === 0
                            ? 'text-zink-800 dark:text-zink-200'
                            : lastRankedGame.mmrChange > 0
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                        )}
                      >
                        {lastRankedGame.mmrChange === 0 ? (
                          'Tied'
                        ) : lastRankedGame.mmrChange > 0 ? (
                          <ChevronUp className='h-3 w-3' />
                        ) : (
                          <ChevronDown className='h-3 w-3' />
                        )}
                        {lastRankedGame.mmrChange !== 0
                          ? numberFormatter.format(
                              Math.trunc(lastRankedGame.mmrChange)
                            )
                          : null}{' '}
                        last match
                      </span>
                    ) : null
                  }
                  icon={
                    <ShieldHalf className='h-5 w-5 text-zink-800 dark:text-zink-200' />
                  }
                  accentColor='text-zink-800 dark:text-zink-200'
                />
              )}
              {isNonNullish(vanillaUserRank?.mmr) &&
                !Number.isNaN(vanillaUserRank?.mmr) && (
                  <StatsCard
                    title='Vanilla MMR'
                    value={Math.round(vanillaUserRank.mmr)}
                    icon={
                      <IceCreamCone className='h-5 w-5 text-zink-800 dark:text-zink-200' />
                    }
                    accentColor='text-zink-800 dark:text-zink-200'
                    description={
                      lastVanillaGame ? (
                        <span
                          className={cn(
                            'flex items-center',
                            lastVanillaGame.mmrChange === 0
                              ? 'text-zink-800 dark:text-zink-200'
                              : lastVanillaGame.mmrChange > 0
                                ? 'text-emerald-500'
                                : 'text-rose-500'
                          )}
                        >
                          {lastVanillaGame.mmrChange === 0 ? (
                            'Tied'
                          ) : lastVanillaGame.mmrChange > 0 ? (
                            <ChevronUp className='h-3 w-3' />
                          ) : (
                            <ChevronDown className='h-3 w-3' />
                          )}
                          {lastVanillaGame.mmrChange !== 0
                            ? numberFormatter.format(
                                Math.trunc(lastVanillaGame.mmrChange)
                              )
                            : null}{' '}
                          last match
                        </span>
                      ) : null
                    }
                  />
                )}
              {isNonNullish(smallWorldUserRank?.mmr) &&
                !Number.isNaN(smallWorldUserRank?.mmr) && (
                  <StatsCard
                    title='Smallworld MMR'
                    value={Math.round(smallWorldUserRank.mmr)}
                    icon={
                      <GlobeIcon className='h-4 w-4 text-zink-800 dark:text-zink-200' />
                    }
                    accentColor='text-zink-800 dark:text-zink-200'
                    description={
                      lastSmallworldGame ? (
                        <span
                          className={cn(
                            'flex items-center',
                            lastSmallworldGame.mmrChange === 0
                              ? 'text-zink-800 dark:text-zink-200'
                              : lastSmallworldGame.mmrChange > 0
                                ? 'text-emerald-500'
                                : 'text-rose-500'
                          )}
                        >
                          {lastSmallworldGame.mmrChange === 0 ? (
                            'Tied'
                          ) : lastSmallworldGame.mmrChange > 0 ? (
                            <ChevronUp className='h-3 w-3' />
                          ) : (
                            <ChevronDown className='h-3 w-3' />
                          )}
                          {lastSmallworldGame.mmrChange !== 0
                            ? numberFormatter.format(
                                Math.trunc(lastSmallworldGame.mmrChange)
                              )
                            : null}{' '}
                          last match
                        </span>
                      ) : null
                    }
                  />
                )}
              <StatsCard
                title='Avg Opponent MMR'
                value={Math.round(avgOpponentMmr)}
                icon={<UserIcon className='h-5 w-5 ' />}
                description={''}
                accentColor='text-zink-800 dark:text-zink-200'
              />
            </div>
          </div>
        </div>

        <Tabs defaultValue='matches' className='p-6'>
          <div className='mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
            <TabsList className='bg-gray-100 dark:bg-zinc-800'>
              <TabsTrigger value='matches'>Match History</TabsTrigger>
              <TabsTrigger value='opponents'>Opponents</TabsTrigger>
              <TabsTrigger value='mmr-trends'>MMR Trends</TabsTrigger>
              <TabsTrigger value='winrate-trends'>Winrate Trends</TabsTrigger>
              <TabsTrigger value='stats'>Statistics</TabsTrigger>
              <TabsTrigger value='achievements'>Achievements</TabsTrigger>
            </TabsList>

            <div className='flex flex-wrap items-center gap-2'>
              <div className='mr-2 flex items-center gap-2'>
                <Trophy className='h-4 w-4 text-gray-400 dark:text-zinc-400' />
                <Select
                  value={leaderboardFilter}
                  onValueChange={setLeaderboardFilter}
                >
                  <SelectTrigger className='h-9 w-[150px]'>
                    <SelectValue placeholder='Leaderboard' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Leaderboards</SelectItem>
                    <SelectItem value='ranked'>Ranked</SelectItem>
                    <SelectItem value='vanilla'>Vanilla</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='mr-2 flex items-center gap-2'>
                <Calendar className='h-4 w-4 text-gray-400 dark:text-zinc-400' />
                <Select
                  value={season}
                  onValueChange={(value) => setSeason(value as Season)}
                >
                  <SelectTrigger className='h-9 w-[180px]'>
                    <SelectValue placeholder='Season' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='season4'>
                      {getSeasonDisplayName('season4')}
                    </SelectItem>
                    <SelectItem value='season3'>
                      {getSeasonDisplayName('season3')}
                    </SelectItem>
                    <SelectItem value='season2'>
                      {getSeasonDisplayName('season2')}
                    </SelectItem>
                    <SelectItem value='all'>
                      {getSeasonDisplayName('all')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Filter className='h-4 w-4 text-gray-400 dark:text-zinc-400' />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className='h-9 w-[120px]'>
                  <SelectValue placeholder='Filter' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Games</SelectItem>
                  <SelectItem value='wins'>Wins</SelectItem>
                  <SelectItem value='losses'>Losses</SelectItem>
                  <SelectItem value='ties'>Ties</SelectItem>
                  <SelectItem value='wins-and-losses'>
                    Wins and Losses
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value='matches' className='m-0'>
            <div className='overflow-hidden rounded-lg border'>
              <div className='overflow-x-auto'>
                <GamesTable games={filteredGames} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value='opponents' className='m-0'>
            <div className='overflow-hidden rounded-lg border'>
              <div className='overflow-x-auto'>
                <OpponentsTable games={filteredGames} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value='mmr-trends' className='m-0'>
            <div className='overflow-hidden rounded-lg border'>
              <div className='overflow-x-auto'>
                <MmrTrendChart games={games} season={season} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value='winrate-trends' className='m-0'>
            <div className='overflow-hidden rounded-lg border'>
              <div className='overflow-x-auto'>
                <WinrateTrendChart games={games} season={season} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value='stats' className='m-0'>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              {(rankedLeaderboard || lastRankedGame) && (
                <LeaderboardStatsCard
                  title='Ranked Queue Stats'
                  rank={rankedUserRank?.rank}
                  mmr={
                    lastRankedGame
                      ? Math.trunc(
                          lastRankedGame.playerMmr + lastRankedGame.mmrChange
                        )
                      : undefined
                  }
                  icon={<Trophy className='h-5 w-5 text-violet-500' />}
                  accentColor='text-violet-500'
                />
              )}

              {(vanillaLeaderboard || lastVanillaGame) && (
                <LeaderboardStatsCard
                  title='Vanilla Queue Stats'
                  rank={vanillaUserRank?.rank}
                  mmr={
                    lastVanillaGame
                      ? Math.trunc(
                          lastVanillaGame.playerMmr + lastVanillaGame.mmrChange
                        )
                      : undefined
                  }
                  icon={<Star className='h-5 w-5 text-amber-500' />}
                  accentColor='text-amber-500'
                />
              )}

              {!rankedLeaderboard &&
                !vanillaLeaderboard &&
                !lastRankedGame &&
                !lastVanillaGame && (
                  <div className='col-span-2 flex h-40 items-center justify-center rounded-lg border bg-gray-50 dark:bg-zinc-800/50'>
                    <p className='text-gray-500 dark:text-zinc-400'>
                      No leaderboard data available
                    </p>
                  </div>
                )}
            </div>
          </TabsContent>

          <TabsContent value='achievements' className='m-0'>
            <div className='flex h-40 items-center justify-center rounded-lg border bg-gray-50 dark:bg-zinc-800/50'>
              <p className='text-gray-500 dark:text-zinc-400'>
                Achievements coming soon
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

interface StatsCardProps {
  title: string
  value: number
  icon: React.ReactNode
  description: React.ReactNode
  accentColor?: string
}

function StatsCard({
  title,
  value,
  icon,
  description,
  accentColor = 'text-violet-500',
}: StatsCardProps) {
  return (
    <div className='flex w-fit flex-col items-start justify-self-center p-2 text-center md:justify-self-auto'>
      <h3 className='mb-1 text-nowrap font-medium text-gray-500 text-sm dark:text-zinc-400'>
        {title}
      </h3>
      <div className={'flex items-center gap-2'}>
        <div className='flex items-center justify-center'>{icon}</div>
        <p className={cn('font-bold text-3xl', accentColor)}>{value}</p>
      </div>
      <p className='mt-1 text-gray-500 text-xs dark:text-zinc-400'>
        {description}
      </p>
    </div>
  )
}

interface LeaderboardStatsCardProps {
  title: string
  rank?: number
  mmr?: number
  icon: React.ReactNode
  accentColor?: string
}

function LeaderboardStatsCard({
  title,
  rank,
  mmr,
  icon,
  accentColor = 'text-violet-500',
}: LeaderboardStatsCardProps) {
  return (
    <div className='rounded-lg border bg-white p-6 dark:bg-zinc-800/20'>
      <div className='mb-4 flex items-center gap-3'>
        <div
          className={cn(
            'rounded-full bg-gray-100 p-2 dark:bg-zinc-800',
            accentColor
          )}
        >
          {icon}
        </div>
        <h3 className='font-semibold text-lg'>{title}</h3>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        {rank !== undefined && (
          <div className='rounded-lg bg-gray-50 p-4 dark:bg-zinc-800/40'>
            <p className='text-gray-500 text-sm dark:text-zinc-400'>Rank</p>
            <p className={cn('mt-1 font-bold text-2xl', accentColor)}>
              #{rank}
            </p>
          </div>
        )}

        {mmr !== undefined && (
          <div className='rounded-lg bg-gray-50 p-4 dark:bg-zinc-800/40'>
            <p className='text-gray-500 text-sm dark:text-zinc-400'>MMR</p>
            <p className={cn('mt-1 font-bold text-2xl', accentColor)}>{mmr}</p>
          </div>
        )}

        {rank === undefined && mmr === undefined && (
          <div className='col-span-2 flex h-20 items-center justify-center rounded-lg bg-gray-50 p-4 dark:bg-zinc-800/40'>
            <p className='text-gray-500 dark:text-zinc-400'>
              No data available
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
