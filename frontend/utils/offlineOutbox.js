// frontend/utils/offlineOutbox.js
// Persistent Offline Outbox Manager with Idempotency Keys and Conflict Resolution

const OUTBOX_STORAGE_PREFIX = 'wello_outbox_'

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'outbox_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

export class OfflineOutboxManager {
  constructor(getUserIdFn) {
    this.getUserId = getUserIdFn || (() => 'guest')
    this.isFlushing = false
    this.listeners = new Set()
  }

  getStorageKey() {
    const userId = this.getUserId() || 'guest'
    return `${OUTBOX_STORAGE_PREFIX}${userId}`
  }

  loadQueue() {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(this.getStorageKey())
      return raw ? JSON.parse(raw) : []
    } catch (err) {
      console.warn('[Offline Outbox] Failed to load queue:', err)
      return []
    }
  }

  saveQueue(queue) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(queue))
      this.notifyListeners(queue)
    } catch (err) {
      console.error('[Offline Outbox] Failed to save queue:', err)
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.loadQueue())
    return () => this.listeners.delete(listener)
  }

  notifyListeners(queue) {
    for (const listener of this.listeners) {
      try {
        listener(queue)
      } catch (err) {
        console.error('[Offline Outbox] Listener error:', err)
      }
    }
  }

  /**
   * Enqueue a new mutation
   */
  enqueue({
    action,
    endpoint,
    method = 'POST',
    payload = {},
    entityType = 'generic',
    localId = null,
    baselineUpdatedAt = null,
  }) {
    const queue = this.loadQueue()
    const item = {
      id: generateUUID(),
      idempotencyKey: generateUUID(),
      action,
      endpoint,
      method: method.toUpperCase(),
      payload,
      entityType,
      localId,
      baselineUpdatedAt: baselineUpdatedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending',
    }

    queue.push(item)
    this.saveQueue(queue)
    return item
  }

  getPendingCount() {
    return this.loadQueue().filter((i) => i.status === 'pending' || i.status === 'processing').length
  }

  getPendingItems() {
    return this.loadQueue().filter((i) => i.status === 'pending')
  }

  remove(itemId) {
    const queue = this.loadQueue().filter((i) => i.id !== itemId)
    this.saveQueue(queue)
  }

  markConflict(itemId, conflictData) {
    const queue = this.loadQueue().map((i) => {
      if (i.id === itemId) {
        return {
          ...i,
          status: 'conflict',
          conflictData,
        }
      }
      return i
    })
    this.saveQueue(queue)
  }

  clear() {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(this.getStorageKey())
      this.notifyListeners([])
    } catch {}
  }

  /**
   * Flushes all pending outbox items via batch /api/sync or sequential endpoints
   */
  async flush(apiFetchFn, onConflictCallback) {
    if (this.isFlushing) return { processed: 0, conflicts: 0 }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { processed: 0, conflicts: 0, offline: true }
    }

    const pending = this.getPendingItems()
    if (pending.length === 0) return { processed: 0, conflicts: 0 }

    this.isFlushing = true
    let processedCount = 0
    let conflictCount = 0

    try {
      // 1. Try batch sync via POST /api/sync
      const batchPayload = {
        mutations: pending.map((m) => ({
          id: m.id,
          idempotencyKey: m.idempotencyKey,
          action: m.action,
          endpoint: m.endpoint,
          method: m.method,
          payload: m.payload,
          entityType: m.entityType,
          localId: m.localId,
          baselineUpdatedAt: m.baselineUpdatedAt,
          createdAt: m.createdAt,
        })),
      }

      try {
        const syncRes = await apiFetchFn('/api/sync', {
          method: 'POST',
          body: batchPayload,
        })

        if (syncRes && syncRes.data) {
          const { acknowledgedIds = [], conflicts = [] } = syncRes.data

          // Remove successfully acknowledged outbox items
          if (acknowledgedIds.length > 0) {
            const currentQueue = this.loadQueue()
            const updatedQueue = currentQueue.filter((i) => !acknowledgedIds.includes(i.id))
            this.saveQueue(updatedQueue)
            processedCount = acknowledgedIds.length
          }

          // Handle conflicts
          if (conflicts.length > 0) {
            conflictCount = conflicts.length
            for (const conf of conflicts) {
              this.markConflict(conf.mutationId, conf)
              if (onConflictCallback) {
                onConflictCallback(conf)
              }
            }
          }

          return {
            processed: processedCount,
            conflicts: conflictCount,
            delta: syncRes.data.delta || null,
          }
        }
      } catch (batchErr) {
        console.warn('[Offline Outbox] Batch sync fallback to sequential execution:', batchErr)
      }

      // 2. Sequential fallback if POST /api/sync failed
      const currentQueue = this.loadQueue()
      for (const item of pending) {
        try {
          await apiFetchFn(item.endpoint, {
            method: item.method,
            body: item.payload,
            headers: {
              'Idempotency-Key': item.idempotencyKey,
            },
          })
          this.remove(item.id)
          processedCount++
        } catch (itemErr) {
          // If 409 conflict, handle conflict
          if (itemErr?.statusCode === 409 || itemErr?.response?.status === 409) {
            conflictCount++
            const conflictData = itemErr?.data || { message: 'Conflict detected on server.' }
            this.markConflict(item.id, conflictData)
            if (onConflictCallback) {
              onConflictCallback({ mutationId: item.id, item, conflictData })
            }
          } else {
            console.error(`[Offline Outbox] Item ${item.id} failed:`, itemErr)
          }
        }
      }

      return { processed: processedCount, conflicts: conflictCount }
    } finally {
      this.isFlushing = false
    }
  }
}
