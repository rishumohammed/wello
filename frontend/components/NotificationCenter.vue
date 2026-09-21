<template>
  <div class="relative" ref="containerRef">
    <!-- Bell Trigger Button -->
    <button
      type="button"
      @click.stop="toggleOpen"
      class="notification-bell-btn relative flex items-center justify-center rounded-full transition-all"
      :class="{ 'has-unread': unreadCount > 0, 'active': isOpen }"
      id="topbar-notification-bell"
      aria-label="Notifications"
    >
      <IconBell :size="18" class="bell-icon" />
      
      <!-- Live Unread Badge -->
      <span v-if="unreadCount > 0" class="notification-badge" id="notification-badge-count">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Dropdown Panel -->
    <div
      v-if="isOpen"
      class="notification-dropdown animate-fade-in"
      @click.stop
      id="notification-dropdown-panel"
    >
      <!-- Panel Header -->
      <div class="notification-dropdown-header">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="fw-700 text-sm text-primary">Notifications</span>
            <span v-if="unreadCount > 0" class="badge badge-purple text-2xs fw-700">
              {{ unreadCount }} new
            </span>
          </div>

          <button
            v-if="unreadCount > 0"
            type="button"
            class="btn btn-ghost btn-xs text-xs text-primary"
            @click="markAllAsRead"
            id="btn-mark-all-notifications-read"
          >
            Mark all read
          </button>
        </div>

        <!-- Filter tabs -->
        <div class="notification-filter-tabs mt-2">
          <button
            type="button"
            class="notification-filter-btn"
            :class="{ active: filter === 'all' }"
            @click="filter = 'all'"
          >
            All ({{ notifications.length }})
          </button>
          <button
            type="button"
            class="notification-filter-btn"
            :class="{ active: filter === 'unread' }"
            @click="filter = 'unread'"
          >
            Unread ({{ unreadCount }})
          </button>
        </div>
      </div>

      <!-- Notification Items List -->
      <div class="notification-list-container">
        <div v-if="filteredNotifications.length === 0" class="notification-empty-state">
          <div class="empty-icon-circle">
            <IconBell :size="24" class="text-tertiary opacity-40" />
          </div>
          <div class="fw-600 text-xs text-secondary mt-2">
            {{ filter === 'unread' ? 'No unread notifications' : 'No notifications yet' }}
          </div>
          <div class="text-2xs text-tertiary mt-1">
            {{ filter === 'unread' ? 'You are all caught up on alerts.' : 'Important alerts and milestones will appear here.' }}
          </div>
        </div>

        <div
          v-for="item in filteredNotifications"
          :key="item.id"
          class="notification-item"
          :class="{ 'unread': !item.isRead }"
          @click="handleClickNotification(item)"
          :id="`notification-item-${item.id}`"
        >
          <!-- Type Icon Box -->
          <div class="notification-type-icon" :class="getTypeColor(item.type)">
            <component :is="getTypeIcon(item.type)" :size="14" />
          </div>

          <!-- Content Body -->
          <div class="notification-body">
            <div class="flex items-start justify-between gap-1">
              <span class="notification-title" :class="{ 'fw-700': !item.isRead }">
                {{ item.title }}
              </span>
              <span class="notification-time">{{ formatTimeAgo(item.createdAt) }}</span>
            </div>
            
            <p class="notification-message">{{ item.message }}</p>

            <div v-if="item.actionUrl" class="notification-action-link">
              <span>View details →</span>
            </div>
          </div>

          <!-- Unread Dot & Delete Action -->
          <div class="notification-actions-col">
            <span v-if="!item.isRead" class="unread-dot"></span>
            <button
              type="button"
              class="btn-delete-notification"
              @click.stop="handleDelete(item.id)"
              title="Dismiss"
            >
              <IconX :size="12" />
            </button>
          </div>
        </div>
      </div>

      <!-- Panel Footer -->
      <div class="notification-dropdown-footer">
        <NuxtLink
          to="/settings"
          @click="isOpen = false"
          class="text-xs text-tertiary hover-text-primary text-decoration-none flex items-center justify-between w-full"
          id="link-notification-settings"
        >
          <span>Configure preferences & digests</span>
          <IconSettings :size="13" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWelloStore } from '~/stores/wello'
import IconBell from '~/components/IconBell.vue'
import IconClock from '~/components/IconClock.vue'
import IconReceipt from '~/components/IconReceipt.vue'
import IconAlert from '~/components/IconAlert.vue'
import IconFileText from '~/components/IconFileText.vue'
import IconInsights from '~/components/IconInsights.vue'
import IconCheck from '~/components/IconCheck.vue'
import IconPackage from '~/components/IconPackage.vue'
import IconSettings from '~/components/IconSettings.vue'
import IconX from '~/components/IconX.vue'

const store = useWelloStore()
const router = useRouter()

const isOpen = ref(false)
const filter = ref('all')
const containerRef = ref(null)

const notifications = computed(() => store.notifications || [])
const unreadCount = computed(() => store.unreadNotificationCount || 0)

const filteredNotifications = computed(() => {
  if (filter.value === 'unread') {
    return notifications.value.filter(n => !n.isRead)
  }
  return notifications.value
})

function toggleOpen() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    store.fetchNotifications()
  }
}

function closeDropdown(e) {
  if (containerRef.value && !containerRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('click', closeDropdown)
    store.fetchNotifications()
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', closeDropdown)
  }
})

async function markAllAsRead() {
  await store.markAllNotificationsAsRead()
}

async function handleDelete(id) {
  await store.deleteNotification(id)
}

async function handleClickNotification(item) {
  if (!item.isRead) {
    await store.markNotificationAsRead(item.id)
  }
  isOpen.value = false

  if (item.actionUrl) {
    router.push(item.actionUrl)
  } else {
    // Default routing based on type
    if (item.type?.includes('invoice')) {
      router.push('/invoicing')
    } else if (item.type?.includes('timer')) {
      router.push('/work')
    } else if (item.type?.includes('quote')) {
      router.push('/work')
    } else if (item.type?.includes('leakage') || item.type?.includes('rate')) {
      router.push('/insights')
    }
  }
}

function getTypeIcon(type) {
  switch (type) {
    case 'forgotten_timer':
      return IconClock
    case 'invoice_due_soon':
      return IconReceipt
    case 'invoice_overdue':
      return IconAlert
    case 'quote_awaiting_response':
      return IconFileText
    case 'weekly_leakage_alert':
      return IconInsights
    case 'target_rate_milestone':
      return IconCheck
    default:
      return IconBell
  }
}

function getTypeColor(type) {
  switch (type) {
    case 'forgotten_timer':
      return 'amber'
    case 'invoice_due_soon':
      return 'blue'
    case 'invoice_overdue':
      return 'red'
    case 'quote_awaiting_response':
      return 'purple'
    case 'weekly_leakage_alert':
      return 'orange'
    case 'target_rate_milestone':
      return 'green'
    default:
      return 'neutral'
  }
}

function formatTimeAgo(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.notification-bell-btn {
  width: 38px;
  height: 38px;
  background: var(--bg-surface-elevated, #FFFFFF);
  border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.08));
  color: var(--text-secondary, #4B5563);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.notification-bell-btn:hover,
.notification-bell-btn.active {
  background: var(--bg-surface-subtle, #F9FAFB);
  color: var(--color-primary, #6366F1);
  border-color: rgba(99, 102, 241, 0.3);
}

.notification-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: #EF4444;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #FFFFFF;
  box-shadow: 0 1px 3px rgba(239, 68, 68, 0.4);
  animation: pulse-badge 2s infinite;
}

@keyframes pulse-badge {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

.notification-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 360px;
  max-width: 90vw;
  background: var(--bg-card, #FFFFFF);
  border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.08));
  border-radius: 14px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.06);
  z-index: 1050;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.notification-dropdown-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.06));
  background: var(--bg-surface-subtle, #FAFAFA);
}

.notification-filter-tabs {
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.04);
  padding: 2px;
  border-radius: 8px;
}

.notification-filter-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary, #6B7280);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.notification-filter-btn.active {
  background: #FFFFFF;
  color: var(--text-primary, #111827);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.notification-list-container {
  max-height: 380px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.notification-empty-state {
  padding: 32px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.03);
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.04));
  cursor: pointer;
  transition: background 0.15s ease;
  position: relative;
}

.notification-item:hover {
  background: var(--bg-surface-subtle, #F9FAFB);
}

.notification-item.unread {
  background: rgba(99, 102, 241, 0.03);
}

.notification-type-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.notification-type-icon.amber { background: #FEF3C7; color: #D97706; }
.notification-type-icon.blue { background: #DBEAFE; color: #2563EB; }
.notification-type-icon.red { background: #FEE2E2; color: #DC2626; }
.notification-type-icon.purple { background: #EDE9FE; color: #7C3AED; }
.notification-type-icon.orange { background: #FFEDD5; color: #EA580C; }
.notification-type-icon.green { background: #D1FAE5; color: #059669; }
.notification-type-icon.indigo { background: #E0E7FF; color: #4F46E5; }
.notification-type-icon.neutral { background: #F3F4F6; color: #4B5563; }

.notification-body {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 12px;
  color: var(--text-primary, #111827);
  line-height: 1.3;
}

.notification-time {
  font-size: 10px;
  color: var(--text-tertiary, #9CA3AF);
  white-space: nowrap;
}

.notification-message {
  font-size: 11px;
  color: var(--text-secondary, #4B5563);
  margin-top: 2px;
  line-height: 1.4;
  word-break: break-word;
}

.notification-action-link {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-primary, #6366F1);
  margin-top: 4px;
}

.notification-actions-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.unread-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary, #6366F1);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.btn-delete-notification {
  opacity: 0;
  background: transparent;
  border: none;
  color: var(--text-tertiary, #9CA3AF);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.notification-item:hover .btn-delete-notification {
  opacity: 1;
}

.btn-delete-notification:hover {
  color: #EF4444;
  background: rgba(239, 68, 68, 0.1);
}

.notification-dropdown-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.06));
  background: var(--bg-surface-subtle, #FAFAFA);
}
</style>
