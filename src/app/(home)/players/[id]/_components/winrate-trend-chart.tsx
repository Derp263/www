'use client'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Slider } from '@/components/ui/slider'
import type { SelectGames } from '@/server/db/types'
import { type Season, filterGamesBySeason, getSeasonDisplayName } from '@/shared/seasons'
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

const chartConfig = {
  winrate: {
    label: 'Winrate',
    color: 'var(--color-emerald-500)',
  },
} satisfies ChartConfig

export function WinrateTrendChart({ 
  games, 
  season = 'all' 
}: { 
  games: SelectGames[],
  season?: Season 
}) {
  const [gamesWindow, setGamesWindow] = useState(30)

  // Filter games by season if a specific season is selected
  const seasonFilteredGames = filterGamesBySeason(games, season)

  // Sort games by date (oldest to newest)
  const sortedGames = [...seasonFilteredGames]
    .sort((a, b) => a.gameTime.getTime() - b.gameTime.getTime())
    .filter((game) => game.result === 'win' || game.result === 'loss')

  // Calculate rolling winrate
  const chartData = calculateRollingWinrate(sortedGames, gamesWindow)

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <div>
          <CardTitle>Winrate Trends</CardTitle>
          <CardDescription>{getSeasonDisplayName(season)}</CardDescription>
        </div>
        <div className='flex w-[200px] flex-col gap-2'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              Window size: {gamesWindow} games
            </span>
          </div>
          <Slider
            value={[gamesWindow]}
            onValueChange={(value) => setGamesWindow(value[0] ?? 0)}
            min={5}
            max={Math.min(100, games.length)}
            step={1}
          />
        </div>
      </CardHeader>
      <CardContent className={'p-2'}>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='date'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }
            />
            <YAxis
              dataKey={'winrate'}
              width={40}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name, entry) => {
                    const date = new Date(entry.payload.date)
                    const formattedDate = date.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                    return (
                      <div className='flex flex-col'>
                        <span>{value}%</span>
                        <span className='text-muted-foreground'>
                          {formattedDate}
                        </span>
                      </div>
                    )
                  }}
                />
              }
            />
            <Line
              dataKey='winrate'
              type='natural'
              stroke='var(--color-emerald-500)'
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className='flex-col items-start gap-2 text-sm'>
        <div className='text-muted-foreground leading-none'>
          Showing rolling winrate over the last {gamesWindow} games
        </div>
      </CardFooter>
    </Card>
  )
}

function calculateRollingWinrate(
  games: SelectGames[],
  windowSize: number
): { date: Date; winrate: number }[] {
  if (games.length === 0 || windowSize <= 0) return []

  // Use all games if windowSize is greater than the number of games
  const effectiveWindowSize = Math.min(windowSize, games.length)

  const result: { date: Date; winrate: number }[] = []

  // We need at least windowSize games to start calculating
  for (let i = effectiveWindowSize - 1; i < games.length; i++) {
    // Get the window of games
    const windowGames = games.slice(
      Math.max(0, i - effectiveWindowSize + 1),
      i + 1
    )

    // Count wins in the window
    const wins = windowGames.filter((game) => game.result === 'win').length

    // Calculate winrate as percentage
    const winrate = Math.round((wins / windowGames.length) * 100)

    // Add data point
    if (games[i]) {
      result.push({
        date: games[i]!.gameTime,
        winrate: winrate,
      })
    }
  }

  return result
}
