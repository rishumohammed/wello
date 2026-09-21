<template>
  <div class="analytics-metric-card" :class="{ 'clickable': !!drilldownSegment }" @click="handleCardClick">
    <div class="card-header">
      <div class="title-wrap">
        <span class="metric-label">{{ label }}</span>
        <div v-if="tooltip" class="tooltip-trigger" :title="tooltip" @click.stop>
          <span class="info-icon">?</span>
          <div class="tooltip-popover">{{ tooltip }}</div>
        </div>
      </div>
      <div v-if="sparklineData && sparklineData.length > 1" class="sparkline-wrap">
        <AdminAnalyticsSparkline :data="sparklineData" :color="sparklineColor" :width="80" :height="28" />
      </div>
    </div>

    <div class="card-body">
      <div class="metric-value">
        <span v-if="unit === '$'" class="unit-prefix">$</span>
        {{ formattedValue }}
        <span v-if="unit && unit !== '$'" class="unit-suffix">{{ unit }}</span>
      </div>

      <div class="diff-container" v-if="diffPercent !== undefined && diffPercent !== null">
        <span class="diff-badge" :class="diffClass">
          <span class="diff-arrow">{{ diffArrow }}</span>
          {{ Math.abs(diffPercent) }}%
        </span>
        <span class="diff-label">vs previous period</span>
      </div>
    </div>

    <div v-if="drilldownSegment" class="card-footer">
      <span class="drilldown-link">View details & users &rarr;</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AdminAnalyticsSparkline from './AdminAnalyticsSparkline.vue'

const props = defineProps<{
  label: string
  value: number | string
  unit?: string
  tooltip?: string
  diffPercent?: number
  sparklineData?: number[]
  drilldownSegment?: string
  reverseDiffColors?: boolean // e.g., for churn or errors where lower is better
}>()

const emit = defineEmits<{
  (e: 'drilldown', segment: string): void
}>()

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    if (props.value >= 1000000) return (props.value / 1000000).toFixed(2) + 'M'
    if (props.value >= 10000) return props.value.toLocaleString()
    if (props.unit === '%' || props.unit === 'h') return props.value.toFixed(1)
    return props.value.toLocaleString()
  }
  return props.value || '0'
})

const diffArrow = computed(() => {
  if (!props.diffPercent) return '•'
  return props.diffPercent > 0 ? '↑' : '↓'
})

const diffClass = computed(() => {
  if (!props.diffPercent || props.diffPercent === 0) return 'diff-neutral'
  const isPositive = props.diffPercent > 0
  if (props.reverseDiffColors) {
    return isPositive ? 'diff-negative' : 'diff-positive'
  }
  return isPositive ? 'diff-positive' : 'diff-negative'
})

const sparklineColor = computed(() => {
  if (props.diffPercent === undefined || props.diffPercent === 0) return '#0D9488'
  if (props.reverseDiffColors) {
    return props.diffPercent > 0 ? '#EF4444' : '#10B981'
  }
  return props.diffPercent >= 0 ? '#10B981' : '#EF4444'
})

function handleCardClick() {
  if (props.drilldownSegment) {
    emit('drilldown', props.drilldownSegment)
  }
}
</script>

<style scoped>
.analytics-metric-card {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
  position: relative;
}

.analytics-metric-card:hover {
  border-color: var(--color-primary-light, #99f6e4);
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.08);
}

.analytics-metric-card.clickable {
  cursor: pointer;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.metric-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tooltip-trigger {
  position: relative;
  display: inline-flex;
  cursor: help;
}

.info-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f1f5f9;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.tooltip-trigger:hover .info-icon {
  background: #0d9488;
  color: #ffffff;
}

.tooltip-popover {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: normal;
  width: 200px;
  z-index: 50;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}

.tooltip-trigger:hover .tooltip-popover {
  display: block;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--color-text-main, #0f172a);
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.unit-prefix, .unit-suffix {
  font-size: 1.25rem;
  font-weight: 500;
  color: #64748b;
}

.diff-container {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
}

.diff-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
}

.diff-positive {
  background: #ecfdf5;
  color: #059669;
}

.diff-negative {
  background: #fef2f2;
  color: #dc2626;
}

.diff-neutral {
  background: #f1f5f9;
  color: #64748b;
}

.diff-label {
  color: var(--color-text-muted, #94a3b8);
}

.card-footer {
  margin-top: 14px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border, #f1f5f9);
}

.drilldown-link {
  font-size: 0.75rem;
  color: var(--color-primary, #0d9488);
  font-weight: 600;
}
</style>
