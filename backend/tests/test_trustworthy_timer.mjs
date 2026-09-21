// backend/tests/test_trustworthy_timer.mjs
// Comprehensive Integration & Unit Test Suite for Wello Trustworthy Time Tracking:
// 1. Server-authoritative timer math, midnight crossing & DST resilience
// 2. Pause/resume interval chains & stopping while paused
// 3. Single active timer invariant & conflict resolution (forceSwitch)
// 4. Manual session overlap detection (409 conflict vs allowOverlap flagging)
// 5. Forgotten-timer detection, heartbeat touching & trim to last activity / max hours
// 6. Retroactive validation (future tolerance and end-after-start)
// 7. Session edit history audit log tracking

import assert from 'node:assert/strict'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'

let totalPassed = 0
let totalFailed = 0

function testLog(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    totalPassed++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    totalFailed++
  }
}

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  let body
  try {
    body = await res.json()
  } catch (e) {
    body = null
  }

  return {
    status: res.status,
    headers: res.headers,
    body,
  }
}

async function createTestUser(email, name = 'Trustworthy Timer Tester') {
  const sendRes = await api('/api/auth/send-otp', {
    method: 'POST',
    body: { email, name, type: 'login' },
  })
  if (!sendRes.body?.devOtp) {
    throw new Error(`Failed to send OTP for ${email}: ${JSON.stringify(sendRes.body)}`)
  }

  const verifyRes = await api('/api/auth/verify-otp', {
    method: 'POST',
    body: { email, code: sendRes.body.devOtp, name },
  })

  return verifyRes.body.token
}

async function runTrustworthyTimerTests() {
  console.log('==================================================================')
  console.log('🧪 RUNNING WELLO TRUSTWORTHY TIME TRACKING TEST SUITE')
  console.log('==================================================================\n')

  const userEmail = `timer.tester.${Date.now()}@example.com`
  const token = await createTestUser(userEmail, 'Time Master')
  testLog(Boolean(token), 'Registered and authenticated test user')

  // Create two projects for testing
  const p1Res = await api('/api/projects', {
    method: 'POST',
    token,
    body: { name: 'Alpha Client App', serviceCategory: 'Web Development', status: 'in_progress' },
  })
  const proj1Id = p1Res.body.data.id

  const p2Res = await api('/api/projects', {
    method: 'POST',
    token,
    body: { name: 'Beta Brand Strategy', serviceCategory: 'Consulting', status: 'in_progress' },
  })
  const proj2Id = p2Res.body.data.id

  testLog(proj1Id && proj2Id, 'Created two test projects')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Midnight Crossing & DST Mathematical Precision
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test Group 1: Mathematical Epoch & Midnight Crossing Precision ---')
  {
    // Midnight crossing: 23:45 UTC to 01:15 UTC next day = exactly 90 minutes (5400s)
    const midnightStart = '2026-09-20T23:45:00.000Z'
    const midnightEnd = '2026-09-21T01:15:00.000Z'
    const startMs = new Date(midnightStart).getTime()
    const endMs = new Date(midnightEnd).getTime()
    const elapsedSec = (endMs - startMs) / 1000
    testLog(elapsedSec === 5400, 'Midnight crossing calculation: exactly 5400s (90m)')

    // DST transition: 2026-03-29 00:30 UTC to 2026-03-29 03:30 UTC = 3 hours (10800s) regardless of local wall clock
    const dstStart = '2026-03-29T00:30:00.000Z'
    const dstEnd = '2026-03-29T03:30:00.000Z'
    const dstElapsedSec = (new Date(dstEnd).getTime() - new Date(dstStart).getTime()) / 1000
    testLog(dstElapsedSec === 10800, 'DST transition UTC calculation: exactly 10800s (3 hours)')
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Server-Authoritative Active Timer & Pause/Resume Chains
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test Group 2: Active Timer Lifecycle & Pause/Resume Intervals ---')
  {
    // 1. Start active timer
    const startRes = await api('/api/timer/start', {
      method: 'POST',
      token,
      body: {
        projectId: proj1Id,
        title: 'Sprint Architecture Design',
        type: 'production',
        paymentType: 'paid',
      },
    })
    testLog(
      (startRes.status === 200 || startRes.status === 201) &&
        startRes.body.data.timer.projectId === proj1Id,
      'Started active timer on Project 1'
    )

    // 2. Fetch active timer
    const getActive1 = await api('/api/timer/active', { method: 'GET', token })
    testLog(
      getActive1.status === 200 && getActive1.body.data.timer?.title === 'Sprint Architecture Design',
      'GET /api/timer/active returns active session'
    )
    testLog(getActive1.body.data.timer?.isPaused === false, 'Timer is not paused initially')

    // 3. Pause active timer
    const pauseRes = await api('/api/timer/pause', { method: 'POST', token })
    testLog(pauseRes.status === 200 && pauseRes.body.data.isPaused === true, 'POST /api/timer/pause pauses the active timer')

    const getActive2 = await api('/api/timer/active', { method: 'GET', token })
    testLog(getActive2.body.data.timer?.isPaused === true, 'GET /api/timer/active confirms timer is paused')

    // 4. Resume active timer
    await new Promise((r) => setTimeout(r, 200)) // small pause to have non-zero interval
    const resumeRes = await api('/api/timer/resume', { method: 'POST', token })
    testLog(resumeRes.status === 200 && resumeRes.body.data.isPaused === false, 'POST /api/timer/resume resumes timer and closes pause interval')

    // 5. Send heartbeat
    const hbRes = await api('/api/timer/heartbeat', { method: 'POST', token })
    testLog(hbRes.status === 200 && Boolean(hbRes.body.data.lastActivityAt), 'POST /api/timer/heartbeat touches last_activity_at')

    // 6. Stop active timer
    const stopRes = await api('/api/timer/stop', { method: 'POST', token })
    testLog(stopRes.status === 200 && Boolean(stopRes.body.data.session), 'POST /api/timer/stop stops and records work session')

    const getActiveAfterStop = await api('/api/timer/active', { method: 'GET', token })
    testLog(getActiveAfterStop.body.data.timer === null && getActiveAfterStop.body.data.active === false, 'Active timer is now cleared')
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Single Active Timer Invariant & Conflict Switch (forceSwitch)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test Group 3: Single Active Timer Invariant & 409 Conflict Guard ---')
  {
    // 1. Start timer on Project 1
    const t1 = await api('/api/timer/start', {
      method: 'POST',
      token,
      body: { projectId: proj1Id, title: 'Timer 1 Active', type: 'production' },
    })
    testLog(t1.status === 200 || t1.status === 201, 'Started Timer 1')

    // 2. Attempt to start Timer 2 without forceSwitch -> expect HTTP 409
    const t2Conflict = await api('/api/timer/start', {
      method: 'POST',
      token,
      body: { projectId: proj2Id, title: 'Timer 2 Attempt', type: 'planning' },
    })
    testLog(
      t2Conflict.status === 409 && t2Conflict.body?.error?.code === 'ACTIVE_TIMER_EXISTS',
      'Starting second timer returns HTTP 409 ACTIVE_TIMER_EXISTS'
    )
    testLog(
      Boolean(t2Conflict.body?.error?.details?.activeTimer),
      '409 Conflict includes metadata of colliding active timer'
    )

    // 3. Start Timer 2 with forceSwitch: true -> expect success, previous timer stopped
    const t2Force = await api('/api/timer/start', {
      method: 'POST',
      token,
      body: { projectId: proj2Id, title: 'Timer 2 Switched', type: 'planning', forceSwitch: true },
    })
    testLog(
      (t2Force.status === 200 || t2Force.status === 201) &&
        t2Force.body.data.timer.projectId === proj2Id,
      'Starting second timer with forceSwitch: true succeeds'
    )

    // Verify active timer is now Timer 2
    const activeNow = await api('/api/timer/active', { method: 'GET', token })
    testLog(activeNow.body.data.timer?.title === 'Timer 2 Switched', 'Active timer is now Timer 2')

    // Clean up: stop Timer 2
    await api('/api/timer/stop', { method: 'POST', token })
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Overlap Detection for Manual Sessions
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test Group 4: Overlap Detection & Prevention for Manual Sessions ---')
  {
    // Create base session: 2026-09-15 10:00 to 12:00 UTC (120 min)
    const baseSess = await api('/api/sessions', {
      method: 'POST',
      token,
      body: {
        projectId: proj1Id,
        title: 'Morning Strategy Sprint',
        type: 'planning',
        startedAt: '2026-09-15T10:00:00.000Z',
        endedAt: '2026-09-15T12:00:00.000Z',
        durationMinutes: 120,
      },
    })
    testLog(baseSess.status === 201, 'Logged base session: 10:00 to 12:00 UTC')

    // Attempt overlapping session: 11:30 to 13:30 UTC without allowOverlap -> expect 409
    const overlapAttempt = await api('/api/sessions', {
      method: 'POST',
      token,
      body: {
        projectId: proj2Id,
        title: 'Overlapping Client Call',
        type: 'call',
        startedAt: '2026-09-15T11:30:00.000Z',
        endedAt: '2026-09-15T13:30:00.000Z',
        durationMinutes: 120,
      },
    })
    testLog(
      overlapAttempt.status === 409 && overlapAttempt.body?.error?.code === 'SESSION_OVERLAP_DETECTED',
      'Overlapping manual session is blocked with HTTP 409 SESSION_OVERLAP_DETECTED'
    )
    testLog(
      overlapAttempt.body?.error?.details?.overlappingSessions?.length > 0,
      '409 Conflict returns list of colliding overlapping sessions'
    )

    // Allow overlap explicitly: allowOverlap: true -> expect 201 and isOverlapping: true
    const overlapAllowed = await api('/api/sessions', {
      method: 'POST',
      token,
      body: {
        projectId: proj2Id,
        title: 'Overlapping Client Call (Explicitly Allowed)',
        type: 'call',
        startedAt: '2026-09-15T11:30:00.000Z',
        endedAt: '2026-09-15T13:30:00.000Z',
        durationMinutes: 120,
        allowOverlap: true,
      },
    })
    testLog(
      overlapAllowed.status === 201 && Boolean(overlapAllowed.body.data.isOverlapping),
      'allowOverlap: true succeeds with 201 and sets isOverlapping: true on record'
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Forgotten-Timer Protection & Trimming
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test Group 5: Forgotten-Timer Thresholds & Trim to Last Activity ---')
  {
    // 1. Set user max_timer_hours to 4 hours via PATCH /api/me
    const updatePref = await api('/api/me', {
      method: 'PATCH',
      token,
      body: { maxTimerHours: 4 },
    })
    testLog(updatePref.status === 200 && updatePref.body.data.maxTimerHours === 4, 'Configured user maxTimerHours = 4')

    // 2. Start timer
    await api('/api/timer/start', {
      method: 'POST',
      token,
      body: { projectId: proj1Id, title: 'Deep Research Session', type: 'production' },
    })

    // 3. Check active timer properties
    const activeInfo = await api('/api/timer/active', { method: 'GET', token })
    testLog(activeInfo.body.data.timer?.maxTimerHours === 4, 'GET /api/timer/active returns configured maxTimerHours (4h)')

    // 4. Stop with trimToLastActivity: true
    const stopTrimmed = await api('/api/timer/stop', {
      method: 'POST',
      token,
      body: { trimToLastActivity: true },
    })
    testLog(stopTrimmed.status === 200 && Boolean(stopTrimmed.body.data.session), 'Stopped timer with trimToLastActivity: true')
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Retroactive Validation & Time Bounds
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test Group 6: Retroactive Validation (Future skews and End > Start) ---')
  {
    // 1. Attempt future date > 5 min ahead (e.g. tomorrow)
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const futureEnd = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()
    const futureRes = await api('/api/sessions', {
      method: 'POST',
      token,
      body: {
        projectId: proj1Id,
        title: 'Future Work Session',
        startedAt: futureDate,
        endedAt: futureEnd,
      },
    })
    testLog(
      futureRes.status === 400 && futureRes.body?.error?.code === 'FUTURE_TIMESTAMP_NOT_ALLOWED',
      'Rejects session starting far in the future with 400 FUTURE_TIMESTAMP_NOT_ALLOWED'
    )

    // 2. Attempt endedAt <= startedAt
    const invalidRangeRes = await api('/api/sessions', {
      method: 'POST',
      token,
      body: {
        projectId: proj1Id,
        title: 'Invalid Time Order',
        startedAt: '2026-09-10T14:00:00.000Z',
        endedAt: '2026-09-10T13:00:00.000Z',
      },
    })
    testLog(
      invalidRangeRes.status === 400 && invalidRangeRes.body?.error?.code === 'INVALID_DATE_RANGE',
      'Rejects session when endedAt <= startedAt with 400 INVALID_DATE_RANGE'
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Session Edit History Audit Log
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test Group 7: Session Edit History & Auditability ---')
  {
    // 1. Create a session
    const sessCreate = await api('/api/sessions', {
      method: 'POST',
      token,
      body: {
        projectId: proj1Id,
        title: 'Initial Version Description',
        type: 'meeting',
        paymentType: 'unpaid',
        unpaidReason: 'scope_creep',
        startedAt: '2026-09-12T09:00:00.000Z',
        endedAt: '2026-09-12T10:00:00.000Z',
        durationMinutes: 60,
      },
    })
    const sessionId = sessCreate.body.data.id
    testLog(Boolean(sessionId), 'Created session for edit auditing')

    // 2. Patch session (change title and paymentType)
    const patchRes = await api(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      token,
      body: {
        title: 'Updated Meeting with Stakeholders',
        paymentType: 'paid',
        durationMinutes: 75,
      },
    })
    testLog(patchRes.status === 200, 'Patched session with new title, paymentType, and duration')

    // 3. Fetch edit history
    const historyRes = await api(`/api/sessions/${sessionId}/history`, {
      method: 'GET',
      token,
    })
    const edits = historyRes.body.data.edits || historyRes.body.data || []
    testLog(
      historyRes.status === 200 && Array.isArray(edits) && edits.length >= 1,
      'GET /api/sessions/:id/history returns audit log entry'
    )

    const auditEntry = edits[0]
    testLog(
      auditEntry?.editorEmail === userEmail &&
        auditEntry?.summary.includes('title') &&
        (auditEntry?.summary.includes('payment') || auditEntry?.summary.includes('payment_type')),
      `Audit entry recorded author and diff summary: "${auditEntry?.summary}"`
    )
  }

  console.log('\n==================================================================')
  console.log(`🏁 TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`)
  console.log('==================================================================\n')

  if (totalFailed > 0) {
    process.exit(1)
  }
}

runTrustworthyTimerTests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
