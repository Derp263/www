'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your content here...',
  minHeight = '400px',
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<string>('write')
  const [previewContent, setPreviewContent] = useState<string>(value)

  // Always update preview content when value changes
  useEffect(() => {
    setPreviewContent(value)
  }, [value])

  return (
    <div className='w-full'>
      {/* Tabs are only visible on mobile */}
      <div className='md:hidden'>
        <Tabs
          defaultValue='write'
          value={activeTab}
          onValueChange={setActiveTab}
          className='w-full'
        >
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='write'>Write</TabsTrigger>
            <TabsTrigger value='preview'>Preview</TabsTrigger>
          </TabsList>

          <TabsContent value='write' className='mt-2'>
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className='min-h-[400px] font-mono'
              style={{ minHeight }}
            />
          </TabsContent>

          <TabsContent value='preview' className='mt-2'>
            <div
              className='prose prose-sm dark:prose-invert w-full max-w-none rounded-md border p-4'
              style={{ minHeight }}
            >
              {previewContent ? (
                <ReactMarkdown>{previewContent}</ReactMarkdown>
              ) : (
                <p className='text-muted-foreground'>Nothing to preview</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Side-by-side layout for desktop */}
      <div className='hidden md:grid md:grid-cols-2 md:gap-4'>
        <div className='w-full'>
          <div className='mb-2 font-medium'>Write</div>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className='min-h-[400px] font-mono'
            style={{ minHeight }}
          />
        </div>
        <div className='w-full'>
          <div className='mb-2 font-medium'>Preview</div>
          <div
            className='prose prose-sm dark:prose-invert w-full max-w-none rounded-md border p-4'
            style={{ minHeight }}
          >
            {previewContent ? (
              <ReactMarkdown>{previewContent}</ReactMarkdown>
            ) : (
              <p className='text-muted-foreground'>Nothing to preview</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
