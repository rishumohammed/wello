// backend/api/auth/unsubscribe.post.ts
import { defineEventHandler, readBody } from 'h3'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError } from '../../utils/apiResponse'
import { getOptionalUser } from '../../utils/authGuard'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const isResubscribe = Boolean(body.resubscribe)
  const db = getDb()

  let user = null
  const authUser = await getOptionalUser(event)

  if (isResubscribe && authUser) {
    user = await db('users').where({ id: authUser.id }).first()
  } else if (token) {
    user = await db('users').where({ unsubscribe_token: token }).first()
    if (!user && !isNaN(Number(token))) {
      user = await db('users').where({ id: Number(token) }).first()
    }
  } else if (authUser) {
    user = await db('users').where({ id: authUser.id }).first()
  }

  if (!user) {
    return sendError(event, 404, 'USER_NOT_FOUND', 'User not found or invalid token.')
  }

  if (isResubscribe) {
    await db('users').where({ id: user.id }).update({
      email_unsubscribed_at: null,
      digest_frequency: 'weekly',
      updated_at: db.fn.now(3),
    })

    await db('notification_preferences')
      .where({ user_id: user.id, channel: 'email' })
      .update({ is_enabled: true, updated_at: db.fn.now(3) })

    return sendSuccess(event, {
      resubscribed: true,
      email: user.email,
      message: 'Successfully resubscribed to email digests.',
    })
  }

  await db('users').where({ id: user.id }).update({
    email_unsubscribed_at: db.fn.now(3),
    digest_frequency: 'disabled',
    updated_at: db.fn.now(3),
  })

  await db('notification_preferences')
    .where({ user_id: user.id, channel: 'email' })
    .update({ is_enabled: false, updated_at: db.fn.now(3) })

  return sendSuccess(event, {
    unsubscribed: true,
    email: user.email,
    message: 'Successfully unsubscribed from email digests.',
  })
})
