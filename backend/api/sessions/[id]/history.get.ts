// backend/api/sessions/[id]/history.get.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess, sendError } from '../../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const sessionId = Number(idParam)

  if (!sessionId || isNaN(sessionId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid session ID parameter.')
  }

  const db = getDb()

  // Verify session belongs to user
  const session = await db('work_sessions')
    .where({ id: sessionId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!session) {
    return sendError(event, 404, 'SESSION_NOT_FOUND', 'Work session not found.')
  }

  const edits = await db('work_session_edits')
    .leftJoin('users', 'work_session_edits.editor_user_id', 'users.id')
    .where('work_session_edits.work_session_id', sessionId)
    .select(
      'work_session_edits.id',
      'work_session_edits.work_session_id',
      'work_session_edits.change_summary',
      'work_session_edits.old_values',
      'work_session_edits.new_values',
      'work_session_edits.created_at',
      'users.name as editor_name',
      'users.email as editor_email'
    )
    .orderBy('work_session_edits.created_at', 'desc')

  const parsedEdits = edits.map((e: any) => {
    let oldVals = e.old_values
    let newVals = e.new_values
    try {
      if (typeof oldVals === 'string') oldVals = JSON.parse(oldVals)
      if (typeof newVals === 'string') newVals = JSON.parse(newVals)
    } catch (_) {}

    return {
      id: e.id,
      sessionId: e.work_session_id,
      summary: e.change_summary,
      oldValues: oldVals,
      newValues: newVals,
      editorName: e.editor_name || 'User',
      editorEmail: e.editor_email || '',
      createdAt: e.created_at,
    }
  })

  return sendSuccess(event, {
    sessionId,
    editsCount: parsedEdits.length,
    edits: parsedEdits,
  })
})
