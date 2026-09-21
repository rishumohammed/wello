<template>
  <div v-if="isOpen" class="modal-backdrop" @click="closeModal">
    <div class="drilldown-modal-dialog" @click.stop>
      <div class="modal-header">
        <div class="header-titles">
          <h3 class="modal-title">{{ title || 'User Drilldown' }}</h3>
          <p class="modal-desc">Detailed sample of users matching segment: <strong>{{ segmentKey }}</strong></p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-export-users" @click="exportUsersCsv">
            ⬇ Export CSV
          </button>
          <button type="button" class="btn-close" @click="closeModal">&times;</button>
        </div>
      </div>

      <div class="modal-body">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <span>Loading segment users...</span>
        </div>

        <div v-else-if="users.length === 0" class="empty-state">
          <span>No users currently match this filter criteria.</span>
        </div>

        <div v-else class="table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Country</th>
                <th>Status</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td class="id-col">#{{ user.id }}</td>
                <td class="name-col">{{ user.name }}</td>
                <td class="email-col">
                  <code>{{ user.email }}</code>
                </td>
                <td>
                  <span class="country-pill">{{ user.country || 'US' }}</span>
                </td>
                <td>
                  <span class="status-pill" :class="user.status?.toLowerCase()">
                    {{ user.status }}
                  </span>
                </td>
                <td class="date-col">{{ formatDate(user.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-footer">
        <span class="footer-note">Showing top {{ users.length }} matching accounts. Financial data masked in accordance with Privacy Rule $k \ge 5$.</span>
        <button type="button" class="btn-done" @click="closeModal">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface DrilldownUser {
  id: number
  name: string
  email: string
  status: string
  country: string
  createdAt: string
}

const props = defineProps<{
  isOpen: boolean
  segmentKey: string
  title?: string
  users: DrilldownUser[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function closeModal() {
  emit('close')
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function exportUsersCsv() {
  if (props.users.length === 0) return
  const headers = ['ID', 'Name', 'Email', 'Country', 'Status', 'Registered At']
  const rows = props.users.map((u) => [
    u.id,
    `"${u.name}"`,
    `"${u.email}"`,
    u.country,
    u.status,
    `"${u.createdAt}"`,
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `users_segment_${props.segmentKey}_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.drilldown-modal-dialog {
  background: #ffffff;
  border-radius: 14px;
  width: 100%;
  max-width: 800px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 2px 0;
}

.modal-desc {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-export-users {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
}

.btn-close:hover {
  color: #0f172a;
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  color: #64748b;
  font-size: 0.875rem;
  gap: 12px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #0d9488;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.table-wrap {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.users-table th {
  background: #f8fafc;
  padding: 10px 12px;
  text-align: left;
  font-weight: 700;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

.users-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}

.id-col {
  color: #94a3b8;
  font-family: monospace;
}

.name-col {
  font-weight: 600;
  color: #0f172a;
}

.email-col code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #475569;
}

.country-pill {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #475569;
}

.status-pill {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-pill.active { background: #ecfdf5; color: #059669; }
.status-pill.inactive { background: #f1f5f9; color: #64748b; }
.status-pill.pending_verification { background: #fef3c7; color: #d97706; }
.status-pill.suspended { background: #fef2f2; color: #dc2626; }

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.footer-note {
  font-size: 0.75rem;
  color: #64748b;
}

.btn-done {
  background: #0d9488;
  color: #ffffff;
  border: none;
  padding: 7px 18px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
