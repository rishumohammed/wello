// backend/api/uploads/[filename].get.ts
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { getStorageDriver } from '../../utils/storageDriver'

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, 'filename')

  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file parameter.' })
  }

  const driver = getStorageDriver()
  try {
    const file = await driver.get(filename)
    if (!file) {
      throw createError({ statusCode: 404, statusMessage: 'File not found.' })
    }

    setResponseHeader(event, 'Content-Type', file.mimeType)
    setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
    setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')

    return file.buffer
  } catch (err: any) {
    if (err.statusCode === 404) throw err
    throw createError({ statusCode: 404, statusMessage: 'File not found or inaccessible.' })
  }
})
