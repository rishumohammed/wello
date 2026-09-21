<template>
  <div class="cohort-heatmap-container">
    <div class="heatmap-header">
      <div class="heatmap-title-wrap">
        <h4 class="heatmap-title">{{ title || 'Retention Cohort Analysis' }}</h4>
        <p class="heatmap-desc">{{ description || 'Percentage of new users returning in subsequent weeks/months' }}</p>
      </div>
      <div class="granularity-badge">
        Cohort Type: <strong>{{ cohortType === 'monthly' ? 'Monthly' : 'Weekly' }}</strong>
      </div>
    </div>

    <div class="matrix-scroll-wrapper">
      <table class="heatmap-table">
        <thead>
          <tr>
            <th class="sticky-col period-header">Cohort</th>
            <th class="sticky-col-2 size-header">Users</th>
            <th v-for="p in maxPeriods" :key="p" class="period-step-header">
              {{ cohortType === 'monthly' ? 'M' + (p - 1) : 'W' + (p - 1) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in cohorts" :key="c.cohortPeriod">
            <!-- Cohort Name -->
            <td class="sticky-col cohort-period-cell">{{ c.cohortPeriod }}</td>
            <!-- Cohort Size -->
            <td class="sticky-col-2 cohort-size-cell">{{ c.cohortSize.toLocaleString() }}</td>
            <!-- Retention Cells -->
            <td
              v-for="p in maxPeriods"
              :key="p"
              class="heatmap-cell"
              :style="getCellStyle(getCell(c, p - 1))"
            >
              <div v-if="getCell(c, p - 1)" class="cell-content">
                <span class="rate-val">{{ getCell(c, p - 1)?.retentionRate }}%</span>
                <div class="cell-tooltip">
                  <strong>{{ getCell(c, p - 1)?.retainedUsers.toLocaleString() }}</strong> / {{ c.cohortSize.toLocaleString() }} users retained
                </div>
              </div>
              <span v-else class="cell-empty">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface CohortPeriod {
  periodNumber: number
  retainedUsers: number
  retentionRate: number
}

export interface CohortRow {
  cohortPeriod: string
  cohortSize: number
  periods: CohortPeriod[]
}

const props = defineProps<{
  cohorts: CohortRow[]
  cohortType?: 'weekly' | 'monthly'
  title?: string
  description?: string
}>()

const maxPeriods = computed(() => {
  let max = 0
  props.cohorts.forEach((c) => {
    c.periods.forEach((p) => {
      if (p.periodNumber + 1 > max) max = p.periodNumber + 1
    })
  })
  return Math.min(max || 8, 13)
})

function getCell(row: CohortRow, periodNumber: number): CohortPeriod | undefined {
  return row.periods.find((p) => p.periodNumber === periodNumber)
}

function getCellStyle(cell?: CohortPeriod) {
  if (!cell) return {}
  const rate = cell.retentionRate
  // Scale between 0% and 100% using HSL teal/emerald shades
  // Period 0 (100%) is dark teal, 50% is medium teal, 10% is very light
  const alpha = Math.max(0.12, rate / 100)
  const isDark = rate > 45

  return {
    backgroundColor: `rgba(13, 148, 136, ${alpha})`,
    color: isDark ? '#ffffff' : '#0f172a',
  }
}
</script>

<style scoped>
.cohort-heatmap-container {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.heatmap-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.heatmap-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px 0;
}

.heatmap-desc {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0;
}

.granularity-badge {
  font-size: 0.8125rem;
  color: #475569;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 6px;
}

.matrix-scroll-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.heatmap-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  text-align: center;
}

.heatmap-table th, .heatmap-table td {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
}

.heatmap-table thead th {
  background: #f8fafc;
  font-weight: 700;
  color: #475569;
}

.sticky-col {
  position: sticky;
  left: 0;
  background: #ffffff;
  z-index: 2;
  text-align: left;
  font-weight: 600;
  min-width: 100px;
}

.sticky-col-2 {
  position: sticky;
  left: 100px;
  background: #ffffff;
  z-index: 2;
  text-align: right;
  min-width: 80px;
}

.heatmap-table thead .sticky-col,
.heatmap-table thead .sticky-col-2 {
  background: #f8fafc;
  z-index: 3;
}

.cohort-period-cell {
  color: #1e293b;
}

.cohort-size-cell {
  color: #64748b;
}

.heatmap-cell {
  position: relative;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s;
}

.heatmap-cell:hover {
  filter: brightness(0.92);
}

.cell-content {
  position: relative;
}

.cell-tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: #0f172a;
  color: #ffffff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  white-space: nowrap;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

.heatmap-cell:hover .cell-tooltip {
  display: block;
}

.cell-empty {
  color: #cbd5e1;
}
</style>
