// server/utils/analyticsEngine.ts
// Analytics Event Engine & Registration Funnel Tracker for Wello

export type FunnelStage =
  | 'registration_started'
  | 'basic_details_submitted'
  | 'email_verification_sent'
  | 'email_verified'
  | 'profile_started'
  | 'profile_completed'
  | 'category_selected'
  | 'location_added'
  | 'registration_completed'
  | 'first_job_activity'
  | 'first_connection'

export interface AnalyticsEvent {
  id: string
  userId?: string
  email?: string
  eventName: string
  stage?: FunnelStage
  metadata?: Record<string, any>
  ipAddress?: string
  createdAt: string
}

export interface FunnelStageMetric {
  stageKey: FunnelStage
  stageName: string
  count: number
  conversionRate: number // percentage relative to stage 1
  dropOffRate: number // percentage relative to previous stage
}

export const FUNNEL_STAGES_LIST: { key: FunnelStage; name: string }[] = [
  { key: 'registration_started',      name: '1. Registration Started' },
  { key: 'basic_details_submitted',  name: '2. Basic Details Submitted' },
  { key: 'email_verification_sent',  name: '3. Email Verification Sent' },
  { key: 'email_verified',           name: '4. Email Verified' },
  { key: 'profile_started',          name: '5. Profile Started' },
  { key: 'profile_completed',        name: '6. Profile Completed' },
  { key: 'category_selected',       name: '7. Category/Interest Selected' },
  { key: 'location_added',           name: '8. Location Added' },
  { key: 'registration_completed',   name: '9. Registration Completed' },
  { key: 'first_job_activity',       name: '10. First Job/Service Activity' },
  { key: 'first_connection',         name: '11. First Connection' },
]

// Server event store
const analyticsEvents: AnalyticsEvent[] = []

// Seed initial realistic analytics events for demonstration & funnel tracking
const now = Date.now()
const sampleEmails = [
  'rahul@mehtatech.in', 'priya.sharma@design.io', 'amit.patel@devs.in', 'sneha.rao@content.co',
  'vikram.singh@studio.in', 'ananya.iyer@brand.in', 'rohit.kumar@web.org', 'divya.nair@craft.in',
]

// Seed stage events
sampleEmails.forEach((email, idx) => {
  const userId = `u_${idx + 1}`
  const userCreatedAt = new Date(now - (idx + 1) * 86400000).toISOString()

  // Track stages based on user index to simulate natural drop-off
  const stagesReachedCount = Math.max(4, 11 - idx)

  for (let s = 0; s < stagesReachedCount; s++) {
    const stage = FUNNEL_STAGES_LIST[s].key
    analyticsEvents.push({
      id: `evt_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      email,
      eventName: stage,
      stage,
      metadata: { source: 'organic_web' },
      createdAt: userCreatedAt,
    })
  }
})

export function logAnalyticsEvent(event: Omit<AnalyticsEvent, 'id' | 'createdAt'>): AnalyticsEvent {
  const record: AnalyticsEvent = {
    id: 'evt_' + Math.random().toString(36).slice(2, 9),
    createdAt: new Date().toISOString(),
    ...event,
  }
  analyticsEvents.unshift(record)
  if (analyticsEvents.length > 5000) analyticsEvents.pop() // keep last 5000 events
  return record
}

export function getFunnelMetrics(startDate?: string, endDate?: string): FunnelStageMetric[] {
  let filtered = analyticsEvents.filter(e => e.stage)

  if (startDate) {
    const startMs = new Date(startDate).getTime()
    filtered = filtered.filter(e => new Date(e.createdAt).getTime() >= startMs)
  }
  if (endDate) {
    const endMs = new Date(endDate).getTime()
    filtered = filtered.filter(e => new Date(e.createdAt).getTime() <= endMs)
  }

  // Count unique users per stage
  const stageUserSets: Record<FunnelStage, Set<string>> = {
    registration_started: new Set(),
    basic_details_submitted: new Set(),
    email_verification_sent: new Set(),
    email_verified: new Set(),
    profile_started: new Set(),
    profile_completed: new Set(),
    category_selected: new Set(),
    location_added: new Set(),
    registration_completed: new Set(),
    first_job_activity: new Set(),
    first_connection: new Set(),
  }

  filtered.forEach(e => {
    if (e.stage && stageUserSets[e.stage]) {
      const identifier = e.userId || e.email || e.id
      stageUserSets[e.stage].add(identifier)
    }
  })

  const baseCount = stageUserSets.registration_started.size || 1

  let prevCount = baseCount

  return FUNNEL_STAGES_LIST.map((stageObj) => {
    const count = stageUserSets[stageObj.key].size
    const conversionRate = Number(((count / baseCount) * 100).toFixed(1))
    const dropOffRate = prevCount > 0 ? Number((((prevCount - count) / prevCount) * 100).toFixed(1)) : 0
    prevCount = count

    return {
      stageKey: stageObj.key,
      stageName: stageObj.name,
      count,
      conversionRate,
      dropOffRate: Math.max(0, dropOffRate),
    }
  })
}

export function getGeographicAnalytics() {
  return [
    { country: 'India', state: 'Maharashtra', city: 'Mumbai', users: 14, activeJobs: 8 },
    { country: 'India', state: 'Karnataka', city: 'Bengaluru', users: 12, activeJobs: 6 },
    { country: 'India', state: 'Delhi NCR', city: 'New Delhi', users: 9, activeJobs: 5 },
    { country: 'India', state: 'Tamil Nadu', city: 'Chennai', users: 6, activeJobs: 3 },
    { country: 'India', state: 'Telangana', city: 'Hyderabad', users: 5, activeJobs: 2 },
  ]
}

export function getAllEvents(limit: number = 100): AnalyticsEvent[] {
  return analyticsEvents.slice(0, limit)
}
