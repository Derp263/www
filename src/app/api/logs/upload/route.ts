import { auth } from '@/server/auth'
import { db } from '@/server/db'
import { logFiles } from '@/server/db/schema'
import { uploadFile } from '@/server/minio'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated (optional)
    const session = await auth()
    const userId = session?.user?.id

    // Parse the multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert the file to a buffer and text
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileContent = await file.text()

    // Upload the file to MinIO
    const fileUrl = await uploadFile(buffer, file.name, file.type)

    // Store the information in the database with an empty JSON object for now
    // The actual parsed games will be updated via PUT request
    const [logFile] = await db
      .insert(logFiles)
      .values({
        userId,
        fileName: file.name,
        fileUrl,
        parsedJson: {},
      })
      .returning()
    if (!logFile) {
      return NextResponse.json(
        { error: 'This should never happen, hopefully' },
        { status: 500 }
      )
    }
    // Return the log file information
    return NextResponse.json({
      id: logFile.id,
      fileName: logFile.fileName,
      fileUrl: logFile.fileUrl,
      createdAt: logFile.createdAt,
    })
  } catch (error) {
    console.error('Error uploading log file:', error)
    return NextResponse.json(
      { error: 'Failed to upload log file' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Check if user is authenticated (optional)
    const session = await auth()

    // Parse the JSON data
    const data = await req.json()
    const { logFileId, parsedGames } = data

    if (!logFileId) {
      return NextResponse.json(
        { error: 'No log file ID provided' },
        { status: 400 }
      )
    }

    if (!parsedGames || !Array.isArray(parsedGames)) {
      return NextResponse.json(
        { error: 'Invalid parsed games data' },
        { status: 400 }
      )
    }

    // Update the log file record with the parsed games
    await db
      .update(logFiles)
      .set({
        parsedJson: parsedGames,
      })
      .where(eq(logFiles.id, logFileId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating parsed games:', error)
    return NextResponse.json(
      { error: 'Failed to update parsed games' },
      { status: 500 }
    )
  }
}
