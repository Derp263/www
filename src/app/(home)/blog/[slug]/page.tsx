import { formatDate } from '@/lib/utils'
import { api } from '@/trpc/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

type Props = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const post = await api.blog.getBySlug({ slug: (await params).slug })
    return {
      title: post.title,
      description: post.excerpt || `${post.content.substring(0, 160)}...`,
    }
  } catch (error) {
    return {
      title: 'Blog Post Not Found',
      description: 'The requested blog post could not be found.',
    }
  }
}

export default async function BlogPostPage({ params }: Props) {
  try {
    const post = await api.blog.getBySlug({ slug: (await params).slug })

    return (
      <div className='container py-10'>
        <article className='prose prose-lg dark:prose-invert mx-auto'>
          <h1>{post.title}</h1>

          <div className='flex items-center gap-2 text-muted-foreground text-sm'>
            <span>
              {post.author?.name || 'Anonymous'} • {formatDate(post.createdAt)}
            </span>
          </div>

          <div className='mt-8'>
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </div>
        </article>
      </div>
    )
  } catch (error) {
    notFound()
  }
}
