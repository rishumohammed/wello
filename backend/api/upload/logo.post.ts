// backend/api/upload/logo.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import crypto from 'node:crypto'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { processAndValidateImage, getStorageDriver } from '../../utils/storageDriver'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)

  // Accepts base64 encoded data URI (e.g. "data:image/png;base64,...") or raw base64
  let rawData = body?.image || body?.file || body?.data || ''
  let declaredMime = body?.mimeType || 'image/png'
  const originalFilename = (body?.filename || 'logo.png').trim()

  if (!rawData || typeof rawData !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Image payload is required (base64 data URI or string).',
    })
  }

  // Extract base64 content if data URI format
  const dataUriMatch = rawData.match(/^data:([^;]+);base64,(.+)$/)
  if (dataUriMatch) {
    declaredMime = dataUriMatch[1]
    rawData = dataUriMatch[2]
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(rawData, 'base64')
  } catch (err) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid base64 image encoding.',
    })
  }

  // Validate, check magic bytes, and sanitize
  const validated = processAndValidateImage(buffer, declaredMime, originalFilename)
  if (!validated.valid || !validated.cleanBuffer || !validated.mimeType) {
    throw createError({
      statusCode: 400,
      statusMessage: validated.error || 'Invalid image file.',
    })
  }

  // Generate safe storage key (uuid + extension)
  const fileHash = crypto.randomBytes(16).toString('hex')
  const storageKey = `logo_${user.id}_${fileHash}.${validated.extension}`

  const driver = getStorageDriver()
  const fileMeta = await driver.save(validated.cleanBuffer, storageKey, validated.mimeType)

  // Update user's logo_url in MySQL if requested
  if (body?.updateUserProfile !== false) {
    try {
      const db = getDb()
      await db('users')
        .where({ id: user.id })
        .update({ logo_url: fileMeta.url, updated_at: new Date() })
    } catch (e) {
      // safe fallback if column not present
    }
  }

  return {
    success: true,
    url: fileMeta.url,
    key: fileMeta.key,
    size: fileMeta.sizeBytes,
    mimeType: fileMeta.mimeType,
  }
})
