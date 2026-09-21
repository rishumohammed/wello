// backend/utils/apiResponse.ts
import { H3Event, setResponseStatus } from 'h3'
import { ZodError } from 'zod'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  pagination?: {
    limit: number
    nextCursor: string | null
    prevCursor?: string | null
    hasMore: boolean
    total?: number
  }
  error?: {
    code: string
    message: string
    details?: any
  }
}

export function formatZodError(error: ZodError): { code: string; message: string; details: any[] } {
  const details = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }))
  return {
    code: 'VALIDATION_ERROR',
    message: details[0]?.message || 'Invalid input data provided.',
    details,
  }
}

export function sendSuccess<T>(
  event: H3Event,
  data: T,
  pagination?: ApiResponse['pagination'],
  statusCode: number = 200
): ApiResponse<T> {
  setResponseStatus(event, statusCode)
  return {
    success: true,
    data,
    ...(pagination ? { pagination } : {}),
  }
}

export function sendError(
  event: H3Event,
  statusCode: number,
  code: string,
  message: string,
  details?: any
) {
  setResponseStatus(event, statusCode)
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  }
}

export interface CursorPayload {
  val: string | number
  id: number
}

export function encodeCursor(val: string | number | Date, id: number): string {
  const normalizedVal = val instanceof Date ? val.toISOString() : String(val)
  const payload: CursorPayload = { val: normalizedVal, id }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeCursor(cursor?: string | null): CursorPayload | null {
  if (!cursor || typeof cursor !== 'string') return null
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.val !== undefined && parsed.id !== undefined) {
      return { val: parsed.val, id: Number(parsed.id) }
    }
    return null
  } catch {
    return null
  }
}
