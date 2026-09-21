// backend/utils/notificationsEngine.ts
/**
 * Authoritative Notifications & Multi-Channel Preferences Engine for Wello
 * Handles in-app notifications, email notifications with unsubscribe protection,
 * web push hooks, and per-topic preferences.
 */

import { getDb } from './db'
import { dispatchEmailWithLog } from './emailEngine'
import { sendPushNotification } from './pushEngine'

export interface CreateNotificationInput {
  userId: number
  type: 'forgotten_timer' | 'invoice_due_soon' | 'invoice_overdue' | 'quote_awaiting_response' | 'weekly_leakage_alert' | 'target_rate_milestone' | string
  title: string
  message: string
  actionUrl?: string
  metadata?: Record<string, any>
  emailSubject?: string
  emailHtml?: string
}

export interface NotificationRecord {
  id: number
  userId: number
  type: string
  title: string
  message: string
  isRead: boolean
  readAt?: string | null
  actionUrl?: string | null
  metadata?: any
  createdAt: string
}

export interface NotificationPreferenceItem {
  channel: 'in_app' | 'email' | 'push'
  topic: string
  isEnabled: boolean
}

export const ALL_NOTIFICATION_TOPICS = [
  { topic: 'forgotten_timer', label: 'Forgotten Active Timer', description: 'Alerts when timer runs past maximum session hours' },
  { topic: 'invoice_due_soon', label: 'Invoice Due Soon', description: 'Reminders 3 days before an invoice due date' },
  { topic: 'invoice_overdue', label: 'Invoice Overdue', description: 'Alerts when an unpaid invoice passes its due date' },
  { topic: 'quote_awaiting_response', label: 'Quote Proposal Follow-Up', description: 'Prompts when a sent quote has not received client action' },
  { topic: 'weekly_leakage_alert', label: 'Weekly Leakage Insights', description: 'Identifies excessive unpaid friction time and opportunity cost' },
  { topic: 'target_rate_milestone', label: 'Hourly Target Rate Milestones', description: 'Celebrates achieving or beating your target hourly value' },
]

/**
 * Dispatches a notification across enabled channels (in-app, email, push).
 */
export async function createNotification(input: CreateNotificationInput): Promise<{ inAppId?: number; emailDispatched: boolean; pushDispatched: boolean }> {
  const db = getDb()
  const user = await db('users').where({ id: input.userId }).first()
  if (!user) return { emailDispatched: false, pushDispatched: false }

  // 1. Resolve channel preferences
  const prefs = await db('notification_preferences')
    .where({ user_id: input.userId, topic: input.type })
    .select('channel', 'is_enabled')

  const prefMap = new Map<string, boolean>()
  prefs.forEach(p => prefMap.set(p.channel, Boolean(p.is_enabled)))

  const inAppEnabled = prefMap.has('in_app') ? prefMap.get('in_app')! : true
  const emailEnabled = prefMap.has('email') ? prefMap.get('email')! : true
  const pushEnabled = prefMap.has('push') ? prefMap.get('push')! : true

  let inAppId: number | undefined

  // 2. In-App Notification
  if (inAppEnabled) {
    const [insertedId] = await db('notifications').insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      is_read: false,
      read_at: null,
      action_url: input.actionUrl || null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      created_at: db.fn.now(3),
    })
    inAppId = Number(insertedId)
  }

  // 3. Email Notification (if email enabled & user is not globally unsubscribed)
  let emailDispatched = false
  const isUnsubscribed = Boolean(user.email_unsubscribed_at)

  if (emailEnabled && !isUnsubscribed && user.email && (input.emailHtml || input.message)) {
    const subject = input.emailSubject || `[Wello] ${input.title}`
    const htmlBody = input.emailHtml || `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px; background: #FFFFFF;">
        <div style="display: flex; align-items: center; margin-bottom: 16px;">
          <div style="background: #6366F1; color: #fff; width: 36px; height: 36px; border-radius: 8px; font-weight: bold; font-size: 18px; line-height: 36px; text-align: center;">W</div>
          <span style="font-weight: bold; font-size: 18px; margin-left: 10px; color: #111827;">Wello Notification</span>
        </div>
        <h2 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">${input.title}</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #4B5563; margin: 0 0 20px 0;">${input.message}</p>
        ${input.actionUrl ? `<div style="margin: 24px 0;"><a href="${input.actionUrl}" style="display: inline-block; background: #6366F1; color: #FFFFFF; font-weight: 600; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px;">View in Wello</a></div>` : ''}
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0 16px 0;" />
        <p style="font-size: 11px; color: #9CA3AF; margin: 0;">You received this notification according to your Wello Notification Preferences. <a href="https://wello.app/api/auth/unsubscribe?token=${user.unsubscribe_token || user.id}" style="color: #6366F1; text-decoration: underline;">Unsubscribe</a></p>
      </div>
    `
    const dispatchRes = await dispatchEmailWithLog({
      to: user.email,
      subject,
      html: htmlBody,
      templateKey: input.type,
    })
    emailDispatched = dispatchRes.success
  }

  // 4. Web Push Notification
  let pushDispatched = false
  if (pushEnabled) {
    const pushRes = await sendPushNotification(input.userId, {
      title: input.title,
      body: input.message,
      icon: '/icon.png',
      url: input.actionUrl || '/',
      tag: input.type,
    })
    pushDispatched = pushRes.success
  }

  return { inAppId, emailDispatched, pushDispatched }
}

export async function getUserNotifications(userId: number, limit: number = 50, offset: number = 0): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
  const db = getDb()
  const rows = await db('notifications')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)

  const [countRes] = await db('notifications')
    .where({ user_id: userId, is_read: false })
    .count('id as unread')

  const unreadCount = Number(countRes?.unread || 0)

  const notifications: NotificationRecord[] = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    message: r.message,
    isRead: Boolean(r.is_read),
    readAt: r.read_at,
    actionUrl: r.action_url,
    metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
    createdAt: r.created_at,
  }))

  return { notifications, unreadCount }
}

export async function markNotificationAsRead(userId: number, notificationId: number): Promise<boolean> {
  const db = getDb()
  const rows = await db('notifications')
    .where({ id: notificationId, user_id: userId })
    .update({
      is_read: true,
      read_at: db.fn.now(3),
    })
  return rows > 0
}

export async function markAllNotificationsAsRead(userId: number): Promise<number> {
  const db = getDb()
  const rows = await db('notifications')
    .where({ user_id: userId, is_read: false })
    .update({
      is_read: true,
      read_at: db.fn.now(3),
    })
  return rows
}

export async function deleteNotification(userId: number, notificationId: number): Promise<boolean> {
  const db = getDb()
  const rows = await db('notifications')
    .where({ id: notificationId, user_id: userId })
    .delete()
  return rows > 0
}

export async function getNotificationPreferences(userId: number): Promise<{ preferences: NotificationPreferenceItem[]; topics: typeof ALL_NOTIFICATION_TOPICS }> {
  const db = getDb()
  const rows = await db('notification_preferences').where({ user_id: userId })
  const existingMap = new Map<string, boolean>()
  rows.forEach(r => existingMap.set(`${r.channel}:${r.topic}`, Boolean(r.is_enabled)))

  const channels: Array<'in_app' | 'email' | 'push'> = ['in_app', 'email', 'push']
  const preferences: NotificationPreferenceItem[] = []

  for (const t of ALL_NOTIFICATION_TOPICS) {
    for (const c of channels) {
      const key = `${c}:${t.topic}`
      preferences.push({
        channel: c,
        topic: t.topic,
        isEnabled: existingMap.has(key) ? existingMap.get(key)! : true,
      })
    }
  }

  return { preferences, topics: ALL_NOTIFICATION_TOPICS }
}

export async function updateNotificationPreferences(userId: number, items: any[]): Promise<boolean> {
  const db = getDb()
  const normalizedItems: NotificationPreferenceItem[] = []

  for (const it of items) {
    if (it.channel && it.topic) {
      normalizedItems.push({
        channel: it.channel,
        topic: it.topic,
        isEnabled: it.isEnabled ?? it.is_enabled ?? true,
      })
    } else if (it.type || it.topic) {
      const topic = it.type || it.topic
      if (it.inApp !== undefined || it.in_app !== undefined) {
        normalizedItems.push({
          channel: 'in_app',
          topic,
          isEnabled: Boolean(it.inApp ?? it.in_app),
        })
      }
      if (it.email !== undefined) {
        normalizedItems.push({
          channel: 'email',
          topic,
          isEnabled: Boolean(it.email),
        })
      }
      if (it.push !== undefined) {
        normalizedItems.push({
          channel: 'push',
          topic,
          isEnabled: Boolean(it.push),
        })
      }
    }
  }

  for (const it of normalizedItems) {
    const existing = await db('notification_preferences')
      .where({ user_id: userId, channel: it.channel, topic: it.topic })
      .first()

    if (existing) {
      await db('notification_preferences')
        .where({ id: existing.id })
        .update({ is_enabled: it.isEnabled, updated_at: db.fn.now(3) })
    } else {
      await db('notification_preferences').insert({
        user_id: userId,
        channel: it.channel,
        topic: it.topic,
        is_enabled: it.isEnabled,
        created_at: db.fn.now(3),
        updated_at: db.fn.now(3),
      })
    }
  }
  return true
}
