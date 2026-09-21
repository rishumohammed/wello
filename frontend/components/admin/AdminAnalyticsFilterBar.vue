<template>
  <div class="analytics-filter-bar">
    <!-- Top Row: Date Presets, Compare, Granularity, Timezone, Export -->
    <div class="filter-main-row">
      <!-- Date Presets -->
      <div class="preset-group">
        <button
          v-for="p in presets"
          :key="p.value"
          type="button"
          class="preset-btn"
          :class="{ active: modelValue.range === p.value }"
          @click="selectPreset(p.value)"
        >
          {{ p.label }}
        </button>
      </div>

      <!-- Custom Date Pickers (if custom selected) -->
      <div v-if="modelValue.range === 'custom'" class="custom-dates">
        <input
          type="date"
          class="date-input"
          :value="modelValue.startDate"
          @change="updateFilter('startDate', ($event.target as HTMLInputElement).value)"
        />
        <span class="date-sep">&rarr;</span>
        <input
          type="date"
          class="date-input"
          :value="modelValue.endDate"
          @change="updateFilter('endDate', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Compare Toggle -->
      <label class="compare-toggle">
        <input
          type="checkbox"
          :checked="modelValue.compare"
          @change="updateFilter('compare', ($event.target as HTMLInputElement).checked)"
        />
        <span class="compare-label">Compare to previous period</span>
      </label>

      <!-- Granularity -->
      <div class="granularity-select">
        <span class="filter-label">Granularity:</span>
        <select
          :value="modelValue.granularity || 'day'"
          class="select-input"
          @change="updateFilter('granularity', ($event.target as HTMLSelectElement).value)"
        >
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </div>

      <!-- Timezone Selector -->
      <div class="tz-select">
        <span class="filter-label">Timezone:</span>
        <select
          :value="modelValue.timezone || 'UTC'"
          class="select-input"
          @change="updateFilter('timezone', ($event.target as HTMLSelectElement).value)"
        >
          <option value="UTC">UTC (Platform Standard)</option>
          <option value="local">Local Browser Time</option>
        </select>
      </div>

      <!-- Export & Saved Views Actions -->
      <div class="actions-group">
        <!-- Saved Views Dropdown -->
        <div class="dropdown-wrapper">
          <button type="button" class="btn-secondary" @click="showSavedViews = !showSavedViews">
            <span class="btn-icon">🔖</span>
            Saved Views
          </button>
          <div v-if="showSavedViews" class="dropdown-menu">
            <div class="menu-header">
              <span>Saved Filters</span>
              <button class="save-current-btn" @click="openSaveViewModal">+ Save Current</button>
            </div>
            <div v-if="savedViews.length === 0" class="menu-empty">
              No saved views yet.
            </div>
            <div
              v-for="view in savedViews"
              :key="view.id"
              class="menu-item"
              @click="applySavedView(view)"
            >
              <span class="view-name">{{ view.name }}</span>
              <button class="delete-view-btn" @click.stop="deleteSavedView(view.id)">&times;</button>
            </div>
          </div>
        </div>

        <!-- Export Dropdown -->
        <div class="dropdown-wrapper">
          <button type="button" class="btn-primary" @click="showExportMenu = !showExportMenu">
            <span class="btn-icon">⬇</span>
            Export Data
          </button>
          <div v-if="showExportMenu" class="dropdown-menu export-menu">
            <button class="menu-item-btn" @click="triggerExport('csv')">
              📄 Export Filtered CSV
            </button>
            <button class="menu-item-btn" @click="triggerExport('json')">
              📦 Export Filtered JSON
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Row: Dimensional Filter Selectors -->
    <div class="filter-dims-row">
      <div class="dim-filter">
        <span class="dim-label">Country:</span>
        <select
          :value="modelValue.country || 'ALL'"
          class="dim-select"
          @change="updateFilter('country', ($event.target as HTMLSelectElement).value)"
        >
          <option value="ALL">All Countries</option>
          <option value="US">United States (US)</option>
          <option value="GB">United Kingdom (GB)</option>
          <option value="IN">India (IN)</option>
          <option value="DE">Germany (DE)</option>
          <option value="CA">Canada (CA)</option>
          <option value="AU">Australia (AU)</option>
          <option value="FR">France (FR)</option>
        </select>
      </div>

      <div class="dim-filter">
        <span class="dim-label">Category:</span>
        <select
          :value="modelValue.category || 'ALL'"
          class="dim-select"
          @change="updateFilter('category', ($event.target as HTMLSelectElement).value)"
        >
          <option value="ALL">All Categories</option>
          <option value="Software Development">Software Development</option>
          <option value="Design & Creative">Design & Creative</option>
          <option value="Writing & Translation">Writing & Translation</option>
          <option value="Marketing & Sales">Marketing & Sales</option>
        </select>
      </div>

      <div class="dim-filter">
        <span class="dim-label">Platform:</span>
        <select
          :value="modelValue.platform || 'ALL'"
          class="dim-select"
          @change="updateFilter('platform', ($event.target as HTMLSelectElement).value)"
        >
          <option value="ALL">All Platforms</option>
          <option value="pwa">PWA (Installed App)</option>
          <option value="browser">Browser Web</option>
          <option value="mobile">Mobile Browser</option>
        </select>
      </div>

      <div class="dim-filter">
        <span class="dim-label">Acquisition Source:</span>
        <select
          :value="modelValue.utmSource || 'ALL'"
          class="dim-select"
          @change="updateFilter('utmSource', ($event.target as HTMLSelectElement).value)"
        >
          <option value="ALL">All Acquisition Sources</option>
          <option value="organic_direct">Direct / Organic</option>
          <option value="google">Google</option>
          <option value="twitter">Twitter / X</option>
          <option value="linkedin">LinkedIn</option>
          <option value="producthunt">Product Hunt</option>
        </select>
      </div>

      <!-- Reset button if filtered -->
      <button v-if="hasActiveFilters" type="button" class="btn-reset" @click="resetFilters">
        Clear All Filters
      </button>
    </div>

    <!-- Save View Modal -->
    <div v-if="isSaveModalOpen" class="modal-backdrop" @click="isSaveModalOpen = false">
      <div class="modal-dialog" @click.stop>
        <h3>Save Current Filter Configuration</h3>
        <p class="modal-subtitle">Save your current dates, granularity, and filters for quick access.</p>
        <div class="form-group">
          <label>View Name</label>
          <input v-model="newViewName" type="text" class="input-text" placeholder="e.g. US Mobile Freelancers 30d" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" @click="isSaveModalOpen = false">Cancel</button>
          <button type="button" class="btn-primary" :disabled="!newViewName" @click="saveCurrentView">Save View</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

export interface AdminAnalyticsFilter {
  range?: string
  startDate?: string
  endDate?: string
  compare?: boolean
  granularity?: 'day' | 'week' | 'month'
  country?: string
  category?: string
  platform?: string
  utmSource?: string
  addonKey?: string
  timezone?: string
}

const props = defineProps<{
  modelValue: AdminAnalyticsFilter
  activeSection?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: AdminAnalyticsFilter): void
  (e: 'export', format: 'csv' | 'json'): void
}>()

const presets = [
  { label: 'Today', value: 'today' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: 'Quarter', value: 'quarter' },
  { label: 'YTD', value: 'ytd' },
  { label: 'Custom', value: 'custom' },
]

const showSavedViews = ref(false)
const showExportMenu = ref(false)
const isSaveModalOpen = ref(false)
const newViewName = ref('')
const savedViews = ref<any[]>([])

const hasActiveFilters = computed(() => {
  return (
    props.modelValue.country !== 'ALL' ||
    props.modelValue.category !== 'ALL' ||
    props.modelValue.platform !== 'ALL' ||
    props.modelValue.utmSource !== 'ALL' ||
    props.modelValue.range !== '30d'
  )
})

function selectPreset(presetVal: string) {
  const updated = { ...props.modelValue, range: presetVal }
  if (presetVal === 'custom' && !updated.startDate) {
    const now = new Date()
    updated.endDate = now.toISOString().split('T')[0]
    updated.startDate = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
  }
  emit('update:modelValue', updated)
}

function updateFilter(key: keyof AdminAnalyticsFilter, val: any) {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: val,
  })
}

function resetFilters() {
  emit('update:modelValue', {
    range: '30d',
    compare: true,
    granularity: 'day',
    country: 'ALL',
    category: 'ALL',
    platform: 'ALL',
    utmSource: 'ALL',
    timezone: 'UTC',
  })
}

function triggerExport(format: 'csv' | 'json') {
  showExportMenu.value = false
  emit('export', format)
}

function openSaveViewModal() {
  showSavedViews.value = false
  newViewName.value = ''
  isSaveModalOpen.value = true
}

async function fetchSavedViews() {
  try {
    const res = await fetch('/api/admin/analytics/tools/saved-views')
    if (res.ok) {
      const data = await res.json()
      savedViews.value = data.views || []
    }
  } catch (err) {
    console.error('Failed to load saved views', err)
  }
}

async function saveCurrentView() {
  if (!newViewName.value) return
  try {
    const res = await fetch('/api/admin/analytics/tools/saved-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newViewName.value,
        sectionKey: props.activeSection || 'overview',
        filters: props.modelValue,
      }),
    })
    if (res.ok) {
      isSaveModalOpen.value = false
      await fetchSavedViews()
    }
  } catch (err) {
    console.error('Failed to save view', err)
  }
}

async function deleteSavedView(id: number) {
  try {
    const res = await fetch(`/api/admin/analytics/tools/saved-views?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      savedViews.value = savedViews.value.filter(v => v.id !== id)
    }
  } catch (err) {
    console.error('Failed to delete view', err)
  }
}

function applySavedView(view: any) {
  showSavedViews.value = false
  if (view.filters) {
    emit('update:modelValue', { ...view.filters })
  }
}

onMounted(() => {
  fetchSavedViews()
})
</script>

<style scoped>
.analytics-filter-bar {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.filter-main-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
}

.preset-group {
  display: inline-flex;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 8px;
}

.preset-btn {
  padding: 6px 14px;
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-btn.active {
  background: #ffffff;
  color: #0d9488;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.custom-dates {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.date-input, .select-input, .dim-select {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.8125rem;
  background: #ffffff;
  color: #1e293b;
}

.compare-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: #475569;
  cursor: pointer;
}

.filter-label, .dim-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
  margin-right: 4px;
}

.actions-group {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.dropdown-wrapper {
  position: relative;
}

.btn-primary {
  background: #0d9488;
  color: #ffffff;
  border: none;
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #0f766e;
}

.btn-secondary {
  background: #f8fafc;
  color: #334155;
  border: 1px solid #cbd5e1;
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  min-width: 220px;
  z-index: 60;
  overflow: hidden;
  padding: 6px 0;
}

.menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  border-bottom: 1px solid #f1f5f9;
}

.save-current-btn {
  background: none;
  border: none;
  color: #0d9488;
  cursor: pointer;
  font-weight: 600;
}

.menu-empty {
  padding: 12px;
  font-size: 0.8125rem;
  color: #94a3b8;
  text-align: center;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 0.8125rem;
  color: #334155;
}

.menu-item:hover {
  background: #f1f5f9;
}

.delete-view-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1rem;
  cursor: pointer;
}

.delete-view-btn:hover {
  color: #ef4444;
}

.menu-item-btn {
  width: 100%;
  text-align: left;
  padding: 9px 14px;
  background: none;
  border: none;
  font-size: 0.8125rem;
  color: #1e293b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-item-btn:hover {
  background: #f8fafc;
  color: #0d9488;
}

.filter-dims-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.dim-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-reset {
  margin-left: auto;
  background: none;
  border: none;
  color: #ef4444;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-dialog {
  background: #ffffff;
  padding: 24px;
  border-radius: 12px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-subtitle {
  font-size: 0.8125rem;
  color: #64748b;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
}

.input-text {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.875rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
