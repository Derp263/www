'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/trpc/react'
import { Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export default function QueueClient() {
  const { data: session } = useSession()
  const [selectedGameMode, setSelectedGameMode] = useState('')
  const [isInQueue, setIsInQueue] = useState(false)
  const [queueTime, setQueueTime] = useState(0)
  const [activeTab, setActiveTab] = useState('queue')

  // Get player state to check if already in queue
  const playerStateQuery = api.playerState.getState.useQuery(
    session?.user?.id || '',
    {
      enabled: !!session?.user?.id,
      refetchInterval: 5000,
    }
  )

  // Get game modes
  const gameModesQuery = api.queue.getGameModes.useQuery()

  // Get queue entries
  const queueEntriesQuery = api.queue.getQueueEntries.useQuery(undefined, {
    refetchInterval: 5000,
  })

  // Get active matches
  const activeMatchesQuery = api.queue.getActiveMatches.useQuery(undefined, {
    refetchInterval: 5000,
  })

  // Get user matches
  const userMatchesQuery = api.queue.getUserMatches.useQuery(undefined, {
    enabled: !!session?.user?.id,
  })

  // Join queue mutation
  const joinQueueMutation = api.queue.joinQueue.useMutation({
    onSuccess: () => {
      toast.success('Joined Queue', {
        description: `You have joined the ${selectedGameMode} queue.`,
      })
      setIsInQueue(true)
    },
    onError: (error) => {
      toast.error('Error', {
        description: error.message,
      })
    },
  })

  // Leave queue mutation
  const leaveQueueMutation = api.queue.leaveQueue.useMutation({
    onSuccess: () => {
      toast.success('Left Queue', {
        description: 'You have left the queue.',
      })
      setIsInQueue(false)
      setQueueTime(0)
    },
    onError: (error) => {
      toast.error('Error', {
        description: error.message,
      })
    },
  })

  // Check if player is already in queue
  useEffect(() => {
    if (playerStateQuery.data?.status === 'queuing') {
      setIsInQueue(true)
      if (playerStateQuery.data.queueStartTime) {
        const startTime = playerStateQuery.data.queueStartTime
        const interval = setInterval(() => {
          setQueueTime(Math.floor((Date.now() - startTime) / 1000))
        }, 1000)
        return () => clearInterval(interval)
      }
    } else {
      setIsInQueue(false)
      setQueueTime(0)
    }
  }, [playerStateQuery.data])

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Handle join queue
  const handleJoinQueue = () => {
    if (!selectedGameMode) {
      toast.error('Error', {
        description: 'Please select a game mode.',
      })

      return
    }

    joinQueueMutation.mutate({ gameMode: selectedGameMode })
  }

  // Handle leave queue
  const handleLeaveQueue = () => {
    leaveQueueMutation.mutate()
  }

  return (
    <div className='space-y-6'>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='queue'>Queue</TabsTrigger>
          <TabsTrigger value='matches'>Active Matches</TabsTrigger>
          <TabsTrigger value='history'>Your Matches</TabsTrigger>
        </TabsList>

        <TabsContent value='queue' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Join Ranked Queue</CardTitle>
              <CardDescription>
                Select a game mode and join the queue to find a match.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isInQueue ? (
                <div className='text-center'>
                  <p className='font-medium text-lg'>You are in queue</p>
                  <p className='text-muted-foreground text-sm'>
                    Time in queue: {formatTime(queueTime)}
                  </p>
                  <Button
                    variant='destructive'
                    className='mt-4'
                    onClick={handleLeaveQueue}
                    disabled={leaveQueueMutation.isPending}
                  >
                    {leaveQueueMutation.isPending ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Leaving...
                      </>
                    ) : (
                      'Leave Queue'
                    )}
                  </Button>
                </div>
              ) : (
                <div className='space-y-4'>
                  <div className='space-y-2'>
                    <label
                      htmlFor='game-mode'
                      className='font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                    >
                      Game Mode
                    </label>
                    <Select
                      value={selectedGameMode}
                      onValueChange={setSelectedGameMode}
                    >
                      <SelectTrigger id='game-mode'>
                        <SelectValue placeholder='Select a game mode' />
                      </SelectTrigger>
                      <SelectContent>
                        {gameModesQuery.data?.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className='w-full'
                    onClick={handleJoinQueue}
                    disabled={joinQueueMutation.isPending || !selectedGameMode}
                  >
                    {joinQueueMutation.isPending ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Joining...
                      </>
                    ) : (
                      'Join Queue'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Players in Queue</CardTitle>
              <CardDescription>
                These players are currently waiting for a match.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queueEntriesQuery.isLoading ? (
                <div className='flex justify-center py-4'>
                  <Loader2 className='h-6 w-6 animate-spin' />
                </div>
              ) : queueEntriesQuery.data?.length === 0 ? (
                <p className='py-4 text-center text-muted-foreground'>
                  No players in queue
                </p>
              ) : (
                <div className='space-y-2'>
                  {queueEntriesQuery.data?.map((entry) => (
                    <div
                      key={entry.entry.id}
                      className='flex items-center justify-between rounded-md border p-2'
                    >
                      <div>
                        <p className='font-medium'>{entry.player.name}</p>
                        <p className='text-muted-foreground text-sm'>
                          {entry.entry.gameMode}
                        </p>
                      </div>
                      <div className='text-muted-foreground text-sm'>
                        {formatTime(
                          Math.floor(
                            (Date.now() -
                              new Date(entry.entry.joinedAt).getTime()) /
                              1000
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='matches' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Active Matches</CardTitle>
              <CardDescription>
                These matches are currently in progress.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeMatchesQuery.isLoading ? (
                <div className='flex justify-center py-4'>
                  <Loader2 className='h-6 w-6 animate-spin' />
                </div>
              ) : activeMatchesQuery.data?.length === 0 ? (
                <p className='py-4 text-center text-muted-foreground'>
                  No active matches
                </p>
              ) : (
                <div className='space-y-2'>
                  {activeMatchesQuery.data?.map((match) => (
                    <div key={match.match.id} className='rounded-md border p-3'>
                      <div className='mb-2 flex items-center justify-between'>
                        <p className='font-medium'>
                          Game #{match.match.gameNumber}
                        </p>
                        <p className='text-muted-foreground text-sm'>
                          {match.match.gameMode}
                        </p>
                      </div>
                      <div className='flex items-center justify-between'>
                        <p>{match.player1.name}</p>
                        <p className='font-medium text-sm'>vs</p>
                        <p>{match.player2.name}</p>
                      </div>
                      <p className='mt-2 text-center text-muted-foreground text-sm'>
                        Started{' '}
                        {formatTime(
                          Math.floor(
                            (Date.now() -
                              new Date(match.match.startedAt).getTime()) /
                              1000
                          )
                        )}{' '}
                        ago
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='history' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Your Match History</CardTitle>
              <CardDescription>
                Your recent matches and results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userMatchesQuery.isLoading ? (
                <div className='flex justify-center py-4'>
                  <Loader2 className='h-6 w-6 animate-spin' />
                </div>
              ) : userMatchesQuery.data?.length === 0 ? (
                <p className='py-4 text-center text-muted-foreground'>
                  No match history
                </p>
              ) : (
                <div className='space-y-2'>
                  {userMatchesQuery.data?.map((match) => {
                    const isPlayer1 = match.player1Id === session?.user?.id
                    const opponent = isPlayer1
                      ? match.player2Id
                      : match.player1Id
                    const result =
                      match.status === 'completed'
                        ? match.winnerId === session?.user?.id
                          ? 'Win'
                          : match.winnerId === null
                            ? 'Draw'
                            : 'Loss'
                        : match.status === 'in_progress'
                          ? 'In Progress'
                          : 'Cancelled'

                    return (
                      <div key={match.id} className='rounded-md border p-3'>
                        <div className='mb-2 flex items-center justify-between'>
                          <p className='font-medium'>
                            Game #{match.gameNumber}
                          </p>
                          <p className='text-muted-foreground text-sm'>
                            {match.gameMode}
                          </p>
                        </div>
                        <div className='flex items-center justify-between'>
                          <p>{isPlayer1 ? 'You' : match.player1Id}</p>
                          <p className='font-medium text-sm'>vs</p>
                          <p>{!isPlayer1 ? 'You' : match.player2Id}</p>
                        </div>
                        <div className='mt-2 flex items-center justify-between'>
                          <p className='text-muted-foreground text-sm'>
                            {new Date(match.startedAt).toLocaleDateString()}
                          </p>
                          <p
                            className={`font-medium text-sm ${
                              result === 'Win'
                                ? 'text-green-500'
                                : result === 'Loss'
                                  ? 'text-red-500'
                                  : ''
                            }`}
                          >
                            {result}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
