// backend/utils/stateMachine.ts

export type ProjectStatus = 'potential' | 'quoted' | 'approved' | 'in_progress' | 'completed' | 'lost'

const ALLOWED_PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  potential: ['quoted', 'approved', 'in_progress', 'lost'],
  quoted: ['approved', 'in_progress', 'lost', 'potential'],
  approved: ['in_progress', 'completed', 'lost'],
  in_progress: ['completed', 'lost', 'approved'],
  completed: ['in_progress'],
  lost: ['potential', 'quoted'],
}

export function validateProjectStatusTransition(
  currentStatus: ProjectStatus,
  newStatus: ProjectStatus
): { valid: boolean; error?: string } {
  if (currentStatus === newStatus) {
    return { valid: true }
  }

  const allowedNext = ALLOWED_PROJECT_TRANSITIONS[currentStatus] || []
  if (!allowedNext.includes(newStatus)) {
    return {
      valid: false,
      error: `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed transitions: ${allowedNext.join(', ') || 'none'}.`,
    }
  }

  return { valid: true }
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'superseded'

export function validateQuoteStatusTransition(
  currentStatus: QuoteStatus,
  newStatus: QuoteStatus
): { valid: boolean; error?: string } {
  if (currentStatus === newStatus) return { valid: true }

  const transitions: Record<QuoteStatus, QuoteStatus[]> = {
    draft: ['sent', 'accepted', 'rejected'],
    sent: ['accepted', 'rejected', 'superseded', 'draft'],
    accepted: ['superseded'],
    rejected: ['draft', 'sent'],
    superseded: [],
  }

  const allowed = transitions[currentStatus] || []
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Invalid quote transition from '${currentStatus}' to '${newStatus}'.`,
    }
  }
  return { valid: true }
}
