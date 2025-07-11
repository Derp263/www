import { formatDate } from '@/lib/utils'
import { api } from '@/trpc/server'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Latest news and updates about Balatro Multiplayer',
}

export default async function BlogPage() {
  const posts = await api.blog.getAllPublished()

  return (
    <div className='container py-10'>
      <h1 className='mb-8 font-bold text-4xl'>Blog</h1>

      {posts.length === 0 ? (
        <p className='text-muted-foreground'>
          No blog posts yet. Check back soon!
        </p>
      ) : (
        <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-3'>
          {posts.map((post) => (
            <article
              key={post.id}
              className='group flex flex-col rounded-lg border p-4 transition-colors hover:bg-muted/50'
            >
              <Link href={`/blog/${post.slug}`} className='flex-1'>
                <h2 className='mb-2 font-semibold text-2xl group-hover:underline'>
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className='mb-4 text-muted-foreground'>{post.excerpt}</p>
                )}
                <div className='mt-auto flex items-center gap-2 text-muted-foreground text-sm'>
                  <span>
                    {post.author?.name || 'Anonymous'} •{' '}
                    {formatDate(post.createdAt)}
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
