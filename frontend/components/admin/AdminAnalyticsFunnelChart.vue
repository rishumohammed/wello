<template>
  <div class="funnel-chart-container">
    <div class="funnel-header">
      <div class="funnel-title-wrap">
        <h4 class="funnel-title">{{ title || 'Acquisition & Activation Funnel' }}</h4>
        <p class="funnel-desc">{{ description || 'End-to-end conversion progression from registration to retention' }}</p>
      </div>
      <div v-if="overallConversionRate !== undefined" class="overall-badge">
        <span class="badge-label">Overall Conversion:</span>
        <span class="badge-val">{{ overallConversionRate }}%</span>
      </div>
    </div>

    <div class="funnel-steps-list">
      <div
        v-for="(step, idx) in steps"
        :key="step.key || idx"
        class="funnel-step-row"
      >
        <!-- Step Info -->
        <div class="step-meta">
          <div class="step-num">{{ idx + 1 }}</div>
          <div class="step-details">
            <span class="step-name">{{ step.name }}</span>
            <span class="step-count">{{ step.count.toLocaleString() }} users</span>
          </div>
        </div>

        <!-- Funnel Bar Visual -->
        <div class="step-bar-wrap">
          <div
            class="step-bar"
            :style="{ width: Math.max(step.conversionVsStage1, 3) + '%' }"
            :class="`bar-color-${idx % 5}`"
          >
            <span class="bar-conversion-label">{{ step.conversionVsStage1 }}% of total</span>
          </div>
        </div>

        <!-- Conversion & Drop-off Stats -->
        <div class="step-stats">
          <div v-if="idx > 0" class="drop-off-pill">
            <span class="drop-val">-{{ step.dropOffVsPrev }}%</span>
            <span class="drop-label">drop-off</span>
          </div>
          <div v-if="step.medianTimeBetweenMin" class="time-stat">
            <span class="time-icon">⏱</span>
            <span>~{{ formatTime(step.medianTimeBetweenMin) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface FunnelStep {
  order: number
  key: string
  name: string
  count: number
  conversionVsStage1: number
  dropOffVsPrev: number
  medianTimeBetweenMin?: number
}

defineProps<{
  steps: FunnelStep[]
  title?: string
  description?: string
  overallConversionRate?: number
}>()

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMin = minutes % 60
  return remainingMin > 0 ? `${hours}h ${remainingMin}m` : `${hours}h`
}
</script>

<style scoped>
.funnel-chart-container {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.funnel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.funnel-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px 0;
}

.funnel-desc {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0;
}

.overall-badge {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 6px 14px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #065f46;
}

.badge-val {
  font-size: 1rem;
  font-weight: 700;
  color: #047857;
}

.funnel-steps-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.funnel-step-row {
  display: grid;
  grid-template-columns: 240px 1fr 160px;
  align-items: center;
  gap: 16px;
}

.step-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f1f5f9;
  color: #475569;
  font-weight: 700;
  font-size: 0.8125rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-details {
  display: flex;
  flex-direction: column;
}

.step-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
}

.step-count {
  font-size: 0.75rem;
  color: #64748b;
}

.step-bar-wrap {
  width: 100%;
  background: #f8fafc;
  border-radius: 8px;
  height: 32px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
}

.step-bar {
  height: 100%;
  border-radius: 6px;
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  padding: 0 12px;
}

.bar-color-0 { background: #0d9488; }
.bar-color-1 { background: #0891b2; }
.bar-color-2 { background: #0284c7; }
.bar-color-3 { background: #2563eb; }
.bar-color-4 { background: #4f46e5; }

.bar-conversion-label {
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.step-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}

.drop-off-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fef2f2;
  color: #b91c1c;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
}

.drop-val {
  font-weight: 700;
}

.drop-label {
  font-size: 0.6875rem;
  opacity: 0.85;
}

.time-stat {
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
}

@media (max-width: 768px) {
  .funnel-step-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
