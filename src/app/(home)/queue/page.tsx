import { auth } from '@/server/auth'
import { redirect } from 'next/navigation'
import QueueClient from './_components/queue-client'

export default async function QueuePage() {
  const session = await auth()

  // Redirect to login if not authenticated
  if (!session) {
    redirect('/api/auth/signin')
  }

  return (
    <div className='container mx-auto py-8'>
      <h1 className='mb-6 font-bold text-3xl'>Ranked Queue</h1>
      <QueueClient />
    </div>
  )
}
