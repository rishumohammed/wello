import { getDb } from './db'
import { H3Event, getHeader } from 'h3'

export function getIdempotencyKey(event: H3Event): string | null {
  const key = getHeader(event, 'idempotency-key') || getHeader(event, 'x-idempotency-key')
  if (!key || typeof key !== 'string') return null
  const trimmed = key.trim()
  return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
}

export async function checkIdempotency(
  userId: number,
  key: string,
  requestPath: string
): Promise<{ exists: boolean; status?: number; body?: any }> {
  const db = getDb()
  const now = new Date()

  const record = await db('idempotency_keys')
    .where({
      user_id: userId,
      key,
      request_path: requestPath,
    })
    .where('expires_at', '>', now)
    .first()

  if (!record) {
    return { exists: false }
  }

  try {
    const parsedBody = JSON.parse(record.response_body)
    return {
      exists: true,
      status: record.response_status,
      body: parsedBody,
    }
  } catch {
    return {
      exists: true,
      status: record.response_status,
      body: record.response_body,
    }
  }
}

export async function saveIdempotency(
  userId: number,
  key: string,
  requestPath: string,
  responseStatus: number,
  responseBody: any,
  ttlHours: number = 24
): Promise<void> {
  const db = getDb()
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
  const bodyString = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)

  await db('idempotency_keys')
    .insert({
      user_id: userId,
      key,
      request_path: requestPath,
      request_method: 'POST',
      response_status: responseStatus,
      response_body: bodyString,
      created_at: new Date(),
      expires_at: expiresAt,
    })
    .onConflict(['user_id', 'key'])
    .merge({
      response_status: responseStatus,
      response_body: bodyString,
      expires_at: expiresAt,
    })
}
