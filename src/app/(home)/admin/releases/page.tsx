import { ReleasesClient } from '@/app/(home)/admin/releases/releases-client'
import { auth } from '@/server/auth'
import { HydrateClient, api } from '@/trpc/server'
import { Suspense } from 'react'

export default async function ReleasesPage() {
  const session = await auth()
  const isAdmin = session?.user.role === 'admin'
  console.log(session)
  if (!isAdmin) {
    return (
      <div className={'container mx-auto pt-8'}>
        <div className={'prose'}>
          <h1>Forbidden</h1>
        </div>
      </div>
    )
  }

  await Promise.all([
    api.releases.getReleases.prefetch(),
    api.branches.getBranches.prefetch(),
  ])

  return (
    <Suspense>
      <HydrateClient>
        <div
          className={
            'mx-auto flex w-[calc(100%-1rem)] max-w-fd-container flex-col gap-4 pt-16'
          }
        >
          <ReleasesClient />
        </div>
      </HydrateClient>
    </Suspense>
  )
}
