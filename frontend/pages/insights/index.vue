<template>
  <div class="insights-page animate-fade-in">
    <!-- Header -->
    <div class="page-header mb-5">
      <h1 class="page-title">Insights</h1>
      <p class="page-subtitle">Understand patterns in your time, conversion yield, and true work-value return.</p>
    </div>

    <!-- Main Period View Selector Tabs: Today | This Week | This Month | All Time | Custom -->
    <div class="period-tabs-bar mb-6" id="insights-period-selector">
      <div class="filter-strip mb-0">
        <button
          v-for="p in periodOptions"
          :key="p.key"
          class="filter-chip"
          :class="{ active: selectedPeriod === p.key }"
          @click="selectedPeriod = p.key"
          :id="`tab-period-${p.key}`"
        >
          {{ p.label }}
        </button>
      </div>
      <div class="text-xs text-tertiary fw-500" id="period-daterange-label">
        {{ currentPeriodData.dateRangeLabel }}
      </div>
    </div>

    <!-- Custom Date Range Bar for Main Period Selector -->
    <div v-if="selectedPeriod === 'custom'" class="card card-padded mb-6 animate-fade-in" id="insights-custom-date-bar">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2 text-xs">
          <span class="fw-600 text-primary">Custom Date Range:</span>
          <span class="text-secondary">From</span>
          <input
            v-model="customStartDate"
            type="date"
            class="form-input form-input-sm"
            :max="customEndDate || todayStr"
            id="input-main-custom-start"
          />
          <span class="text-secondary">To</span>
          <input
            v-model="customEndDate"
            type="date"
            class="form-input form-input-sm"
            :min="customStartDate"
            :max="todayStr"
            id="input-main-custom-end"
          />
        </div>
        <div class="text-xs text-tertiary fw-500">
          {{ currentPeriodData.dateRangeLabel }}
        </div>
      </div>
    </div>

    <!-- SECTION 1: DEDICATED PERIOD WORK-VALUE CARDS -->

    <!-- TODAY VIEW -->
    <div v-if="selectedPeriod === 'today'" class="period-section mb-6" id="section-period-today">
      <div class="grid-3 mb-4">
        <!-- Total Work Time -->
        <div class="metric-card hover-lift" id="today-work-time-card">
          <div class="metric-header">
            <span class="metric-label">Total Work Time</span>
            <div class="metric-icon-box kpi-icon-1">
              <IconClock :size="18" />
            </div>
          </div>
          <div class="metric-value kpi-val-1">{{ currentPeriodData.totalWorkTimeHM }}</div>
          <div class="metric-secondary">across {{ currentPeriodData.sessionsCount }} work session{{ currentPeriodData.sessionsCount !== 1 ? 's' : '' }}</div>
          <div class="flex justify-between text-xs pt-3 mt-3 border-t">
            <span class="text-tertiary">Paid time:</span>
            <span class="fw-600 kpi-val-2">{{ currentPeriodData.paidTimeHM }}</span>
          </div>
        </div>

        <!-- Financials: Revenue & Expenses & Net -->
        <div class="metric-card hover-lift" id="today-financials-card">
          <div class="metric-header">
            <span class="metric-label">Financial Return</span>
            <div class="metric-icon-box kpi-icon-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          </div>
          <div class="metric-value kpi-val-2">{{ store.fmtCurrency(currentPeriodData.revenue) }}</div>
          <div class="metric-secondary">revenue earned / collected</div>
          <div class="flex justify-between text-xs pt-3 mt-3 border-t">
            <span class="text-tertiary">Direct expenses:</span>
            <span class="fw-600 kpi-val-3">{{ store.fmtCurrency(currentPeriodData.expenses) }}</span>
          </div>
        </div>

        <!-- Effective Hourly Value -->
        <div class="metric-card hover-lift" id="today-effective-hourly-card">
          <div class="metric-header">
            <span class="metric-label">Effective Hourly Value</span>
            <div class="metric-icon-box kpi-icon-3">
              <IconInsights :size="18" />
            </div>
          </div>
          <div class="metric-value kpi-val-3">{{ store.fmtHourly(currentPeriodData.effectiveHourlyValue) }}</div>
          <div class="metric-secondary">
            Target: {{ store.fmtHourly(currentPeriodData.targetRate) }}
            <span v-if="currentPeriodData.effectiveHourlyValue >= currentPeriodData.targetRate" class="kpi-val-2 fw-600 ml-1">✓ On target</span>
          </div>
          <div class="flex justify-between text-xs pt-3 mt-3 border-t">
            <span class="text-tertiary">Unpaid client time:</span>
            <span class="fw-600 kpi-val-3">{{ currentPeriodData.unpaidClientTimeHM }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- THIS WEEK VIEW -->
    <div v-else-if="selectedPeriod === 'week'" class="period-section mb-6" id="section-period-week">
      <div class="grid-4 mb-4">
        <!-- Total Work Time & Time Split -->
        <div class="metric-card hover-lift" id="week-work-time-card">
          <div class="metric-header">
            <span class="metric-label">Total Work Time</span>
            <div class="metric-icon-box kpi-icon-1">
              <IconClock :size="18" />
            </div>
          </div>
          <div class="metric-value kpi-val-1">{{ currentPeriodData.totalWorkTimeHM }}</div>
          <div class="metric-sub-breakdown mt-2">
            <div class="flex justify-between text-xs py-1 border-b">
              <span class="text-tertiary">Paid time:</span>
              <span class="fw-600 kpi-val-2">{{ currentPeriodData.paidTimeHM }}</span>
            </div>
            <div class="flex justify-between text-xs py-1">
              <span class="text-tertiary">Unpaid client time:</span>
              <span class="fw-600 kpi-val-3">{{ currentPeriodData.unpaidClientTimeHM }}</span>
            </div>
          </div>
        </div>

        <!-- Revenue & Net Value -->
        <div class="metric-card hover-lift" id="week-financials-card">
          <div class="metric-header">
            <span class="metric-label">Revenue & Net Value</span>
            <div class="metric-icon-box kpi-icon-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          </div>
          <div class="metric-value kpi-val-2">{{ store.fmtCurrency(currentPeriodData.revenue) }}</div>
          <div class="metric-sub-breakdown mt-2">
            <div class="flex justify-between text-xs py-1 border-b">
              <span class="text-tertiary">Expenses:</span>
              <span class="fw-600 kpi-val-3">{{ store.fmtCurrency(currentPeriodData.expenses) }}</span>
            </div>
            <div class="flex justify-between text-xs py-1">
              <span class="text-tertiary">Net economic value:</span>
              <span class="fw-700 text-primary">{{ store.fmtCurrency(currentPeriodData.netValue) }}</span>
            </div>
          </div>
        </div>

        <!-- Average Effective Value -->
        <div class="metric-card hover-lift" id="week-avg-effective-card">
          <div class="metric-header">
            <span class="metric-label">Avg Effective Value</span>
            <div class="metric-icon-box kpi-icon-3">
              <IconInsights :size="18" />
            </div>
          </div>
          <div class="metric-value kpi-val-3">{{ store.fmtHourly(currentPeriodData.effectiveHourlyValue) }}</div>
          <div class="metric-secondary">across all projects this week</div>
          <div class="flex justify-between text-xs pt-3 mt-3 border-t">
            <span class="text-tertiary">Target benchmark:</span>
            <span class="fw-600">{{ store.fmtHourly(currentPeriodData.targetRate) }}</span>
          </div>
        </div>

        <!-- Best-Value Project This Week -->
        <div class="metric-card hover-lift" id="week-best-project-card">
          <div class="metric-header">
            <span class="metric-label">Best-Value Project</span>
            <div class="metric-icon-box kpi-icon-4">
              <IconFolders :size="18" />
            </div>
          </div>
          <div class="fw-700 text-base text-primary truncate mt-1">
            {{ currentPeriodData.bestValueProject ? currentPeriodData.bestValueProject.name : '—' }}
          </div>
          <div class="text-xs kpi-val-4 fw-600 mt-1">
            {{ currentPeriodData.bestValueProject ? store.fmtHourly(currentPeriodData.bestValueProject.effectiveHourly) : '—' }}
          </div>
          <div class="flex justify-between text-xs pt-3 mt-3 border-t">
            <span class="text-tertiary">Hours invested:</span>
            <span class="fw-600">{{ currentPeriodData.bestValueProject ? currentPeriodData.bestValueProject.totalHM : '0m' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- THIS MONTH VIEW (AND ALL TIME) -->
    <div v-else class="period-section mb-6" id="section-period-month">
      <div class="grid-4 mb-4">
        <!-- Total Work Time & Unpaid Time -->
        <div class="metric-card hover-lift" id="month-work-time-card">
          <div class="metric-header">
            <span class="metric-label">Total Work Time</span>
            <div class="metric-icon-box kpi-icon-1">
              <IconClock :size="18" />
            </div>
          </div>
          <div class="metric-value kpi-val-1">{{ currentPeriodData.totalWorkTimeHM }}</div>
          <div class="metric-sub-breakdown mt-2">
            <div class="flex justify-between text-xs py-1 border-b">
              <span class="text-tertiary">Paid time:</span>
              <span class="fw-600 kpi-val-2">{{ currentPeriodData.paidTimeHM }}</span>
            </div>
            <div class="flex justify-between text-xs py-1">
              <span class="text-tertiary">Unpaid client time:</span>
              <span class="fw-600 kpi-val-3">{{ currentPeriodData.unpaidClientTimeHM }}</span>
            </div>
          </div>
        </div>

        <!-- Revenue, Expenses, Net -->
        <div class="metric-card hover-lift" id="month-financials-card">
          <div class="metric-header">
            <span class="metric-label">Revenue & Net Value</span>
            <div class="metric-icon-box kpi-icon-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          </div>
          <div class="metric-value kpi-val-2">{{ store.fmtCurrency(currentPeriodData.revenue) }}</div>
          <div class="metric-sub-breakdown mt-2">
            <div class="flex justify-between text-xs py-1 border-b">
              <span class="text-tertiary">Expenses:</span>
              <span class="fw-600 kpi-val-3">{{ store.fmtCurrency(currentPeriodData.expenses) }}</span>
            </div>
            <div class="flex justify-between text-xs py-1">
              <span class="text-tertiary">Net value:</span>
              <span class="fw-700 text-primary">{{ store.fmtCurrency(currentPeriodData.netValue) }}</span>
            </div>
          </div>
        </div>

        <!-- Effective Value & Value Given Away -->
        <div class="metric-card hover-lift" id="month-effective-val-card">
          <div class="metric-header">
            <span class="metric-label">Effective Hourly Value</span>
            <div class="metric-icon-box kpi-icon-3">
              <IconInsights :size="18" />
            </div>
          </div>
          <div class="metric-value kpi-val-3">{{ store.fmtHourly(currentPeriodData.effectiveHourlyValue) }}</div>
          <div class="metric-sub-breakdown mt-2">
            <div class="flex justify-between text-xs py-1 border-b">
              <span class="text-tertiary">Value given away:</span>
              <span class="fw-600 kpi-val-3">{{ store.fmtCurrency(currentPeriodData.valueGivenAway) }}</span>
            </div>
            <div class="flex justify-between text-xs py-1">
              <span class="text-tertiary">Unpaid proportion:</span>
              <span class="fw-600 kpi-val-3">{{ currentPeriodData.unpaidRatioPct }}%</span>
            </div>
          </div>
        </div>

        <!-- Highest & Lowest Value Projects -->
        <div class="metric-card hover-lift" id="month-extremes-card">
          <div class="metric-header">
            <span class="metric-label">Project Extremes</span>
            <div class="metric-icon-box kpi-icon-4">
              <IconFolders :size="18" />
            </div>
          </div>
          <div class="metric-sub-breakdown mt-1">
            <div class="py-1 border-b">
              <div class="text-xs text-tertiary">Highest-value project:</div>
              <div class="fw-700 text-sm text-primary truncate">
                {{ currentPeriodData.bestValueProject ? currentPeriodData.bestValueProject.name : '—' }}
              </div>
              <div class="text-xs kpi-val-4 fw-600">
                {{ currentPeriodData.bestValueProject ? store.fmtHourly(currentPeriodData.bestValueProject.effectiveHourly) : '—' }}
              </div>
            </div>
            <div class="py-1 pt-2">
              <div class="text-xs text-tertiary">Lowest-value project:</div>
              <div class="fw-700 text-sm text-secondary truncate">
                {{ currentPeriodData.lowestValueProject ? currentPeriodData.lowestValueProject.name : '—' }}
              </div>
              <div class="text-xs text-tertiary">
                {{ currentPeriodData.lowestValueProject ? `${currentPeriodData.lowestValueProject.unpaidHM} unpaid` : '—' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 2: USEFUL SMART INSIGHTS (Truthful & Data-Backed) -->
    <div class="card mb-6" id="insights-smart-cards">
      <div class="card-header">
        <div>
          <div class="card-title">Useful Insights</div>
          <div class="card-subtitle">Automated work-value patterns derived strictly from your active records</div>
        </div>
      </div>

      <div class="card-body">
        <div class="grid-3 gap-4" id="smart-insights-grid">
          <div
            v-for="ins in dynamicInsightsList"
            :key="ins.id"
            class="smart-insight-tile"
            :class="`insight-${ins.type}`"
            :id="`insight-tile-${ins.id}`"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="insight-badge" :class="`badge-${ins.type}`">{{ ins.tag }}</span>
            </div>

            <div class="insight-hero-stat-row" v-if="ins.stat">
              <span class="insight-hero-stat" :class="`stat-${ins.type}`">{{ ins.stat }}</span>
              <span class="insight-hero-sub" v-if="ins.statSub">{{ ins.statSub }}</span>
            </div>

            <div class="insight-tile-title">{{ ins.title }}</div>
            <div class="insight-tile-desc">{{ ins.description || ins.text }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 3: VALUE TREND (7 Days | 30 Days | 90 Days) -->
    <div class="card mb-6" id="insights-trend-section">
      <div class="card-header">
        <div>
          <div class="card-title">Value Trend</div>
          <div class="card-subtitle">Effective hourly rate progression and target comparison</div>
        </div>

        <!-- Trend Range Selector -->
        <div class="filter-strip mb-0" id="trend-range-selector">
          <button
            v-for="t in trendOptions"
            :key="t.key"
            class="filter-chip"
            :class="{ active: selectedTrendRange === t.key }"
            @click="selectedTrendRange = t.key"
            :id="`trend-tab-${t.key}`"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="card-body">
        <!-- Interactive Value Trend Chart -->
        <div class="interactive-bar-chart h-220" id="insights-trend-chart">
          <!-- Target Reference Line -->
          <div
            class="chart-target-line"
            v-if="trendData.targetRate > 0 && maxTrendRate > 0"
            :style="{ bottom: `${Math.min(92, (trendData.targetRate / maxTrendRate) * 160 + 24)}px` }"
          >
            <span class="chart-target-label">Target: {{ store.fmtHourly(trendData.targetRate) }}</span>
          </div>

          <!-- Trend Bar Columns -->
          <div
            v-for="(bar, i) in trendData.points"
            :key="i"
            class="chart-bar-column"
            :class="{ 'is-today': bar.isToday }"
            :title="`${bar.label} (${bar.dateStr || bar.dateRange}): ${store.fmtHourly(bar.rate)} · ${bar.hours}h worked`"
            :id="`trend-bar-${i}`"
          >
            <div class="chart-bar-value-top" v-if="bar.rate > 0">
              {{ store.currency }}{{ bar.rate }}
            </div>
            <div class="chart-bar-value-top text-tertiary" v-else>
              —
            </div>
            <div
              class="chart-bar-fill"
              :style="{
                height: `${maxTrendRate > 0 ? Math.max(8, (bar.rate / maxTrendRate) * 140) : 8}px`,
                opacity: bar.rate === 0 ? '0.25' : (bar.isToday ? '1' : '0.85')
              }"
            ></div>
            <div class="chart-bar-label">{{ bar.label }}</div>
          </div>
        </div>

        <!-- Trend Footer Summary -->
        <div class="flex items-center justify-between flex-wrap gap-4 text-xs mt-6 pt-3 border-t">
          <div class="flex items-center gap-4 text-tertiary">
            <span>Average Rate: <strong class="text-primary">{{ store.fmtHourly(trendData.avgRate) }}</strong></span>
            <span>Peak Rate: <strong class="text-success">{{ store.fmtHourly(trendData.maxRate) }}</strong></span>
            <span>Target Benchmark: <strong class="text-brand">{{ store.fmtHourly(trendData.targetRate) }}</strong></span>
          </div>
          <div class="text-success fw-600">
            ✓ {{ trendData.growthPct }}% Growth over {{ trendData.label }}
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 4: PROJECT CONVERSION ANALYSIS -->
    <div class="card mb-6" id="insights-conversion-analysis">
      <div class="card-header flex items-center justify-between flex-wrap gap-4">
        <div>
          <div class="card-title">Project Conversion Analysis</div>
          <div class="card-subtitle">Tracking pipeline yield and the unbilled time cost of lost opportunities</div>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <!-- Filter: Today | This Week | Month | All | Custom -->
          <div class="filter-strip mb-0" id="conversion-period-selector">
            <button
              v-for="p in convPeriodOptions"
              :key="p.key"
              class="filter-chip"
              :class="{ active: selectedConvPeriod === p.key }"
              @click="selectedConvPeriod = p.key"
              :id="`conv-tab-${p.key}`"
            >
              {{ p.label }}
            </button>
          </div>

          <span class="badge badge-job text-xs">
            {{ conversionData.conversionRatePct }}% Conversion Rate
          </span>
        </div>
      </div>

      <!-- Custom Date Range Bar (shown when custom is selected) -->
      <div v-if="selectedConvPeriod === 'custom'" class="px-6 py-3 border-b bg-surface-secondary flex items-center justify-between flex-wrap gap-3 animate-fade-in" id="conv-custom-date-bar">
        <div class="flex items-center gap-2 text-xs text-secondary">
          <span class="fw-600 text-primary">Custom Range:</span>
          <span>From</span>
          <input
            v-model="convCustomStart"
            type="date"
            class="form-input form-input-sm"
            :max="convCustomEnd || todayStr"
            id="conv-custom-start"
          />
          <span>To</span>
          <input
            v-model="convCustomEnd"
            type="date"
            class="form-input form-input-sm"
            :min="convCustomStart"
            :max="todayStr"
            id="conv-custom-end"
          />
        </div>
        <div class="text-xs text-tertiary">
          Filtering projects created, quoted, or worked between selected dates
        </div>
      </div>

      <div class="card-body">
        <!-- 4-Stat Conversion Banner -->
        <div class="grid-4 mb-5" id="conversion-stats-grid">
          <!-- Started -->
          <div class="conversion-stat-box" id="conv-stat-started">
            <div class="text-xs text-tertiary uppercase fw-600 mb-1">Projects Started</div>
            <div class="conversion-stat-value kpi-val-1">{{ conversionData.totalStarted }}</div>
            <div class="text-tertiary text-xs mt-1">all client engagements</div>
          </div>

          <!-- Converted -->
          <div class="conversion-stat-box" id="conv-stat-converted">
            <div class="text-xs text-tertiary uppercase fw-600 mb-1">Converted to Jobs</div>
            <div class="conversion-stat-value kpi-val-2">{{ conversionData.convertedCount }}</div>
            <div class="text-tertiary text-xs mt-1">{{ conversionData.conversionRatePct }}% success rate</div>
          </div>

          <!-- Lost -->
          <div class="conversion-stat-box" id="conv-stat-lost">
            <div class="text-xs text-tertiary uppercase fw-600 mb-1">Lost Engagements</div>
            <div class="conversion-stat-value kpi-val-3">{{ conversionData.lostCount }}</div>
            <div class="text-tertiary text-xs mt-1">unconverted proposals</div>
          </div>

          <!-- Time in Lost Projects -->
          <div class="conversion-stat-box" id="conv-stat-lost-time">
            <div class="text-xs text-tertiary uppercase fw-600 mb-1">Time in Lost Projects</div>
            <div class="conversion-stat-value kpi-val-4">{{ conversionData.lostTimeHM }}</div>
            <div class="text-tertiary text-xs mt-1">
              Est. value: {{ store.fmtCurrency(conversionData.lostTimeEstValue) }}
            </div>
          </div>
        </div>

        <!-- Lost Projects Detailed Table -->
        <div v-if="conversionData.lostProjects.length > 0" class="table-wrap">
          <table class="table" id="table-lost-projects-insights">
            <thead>
              <tr>
                <th>Lost Engagement</th>
                <th>Client</th>
                <th class="table-text-right">Time Invested</th>
                <th class="table-text-right">Unbilled Value</th>
                <th class="table-text-right">Proposed Quote</th>
                <th>Outcome / Feedback</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="lp in conversionData.lostProjects"
                :key="lp.id"
                @click="navigateTo(`/projects/${lp.id}`)"
                class="cursor-pointer"
                :id="`lost-row-${lp.id}`"
              >
                <td class="fw-600 text-sm">{{ lp.name }}</td>
                <td class="text-secondary text-xs">{{ lp.client?.name || '—' }}</td>
                <td class="table-text-right fw-600 text-warning tabular">{{ lp.timeHM }}</td>
                <td class="table-text-right fw-600 tabular">{{ store.fmtCurrency(lp.estValue) }}</td>
                <td class="table-text-right fw-600 text-secondary tabular">{{ lp.quoteAmount ? store.fmtCurrency(lp.quoteAmount) : '—' }}</td>
                <td class="text-tertiary text-xs max-w-240">{{ lp.quoteNotes || 'Client postponed budget.' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty-state py-8 text-center border-t mt-4" id="empty-lost-projects">
          <div class="text-secondary text-sm fw-600">No lost engagements in this period</div>
          <div class="text-tertiary text-xs mt-1">All client projects in this window were either converted to active jobs or are currently in progress.</div>
        </div>
      </div>
    </div>

    <!-- SECTION 5: TIME DISTRIBUTION & WORK TYPE BREAKDOWN -->
    <div class="grid-2 mb-6">
      <!-- Time Distribution (Paid vs Unpaid) -->
      <div class="card" id="insights-time-distribution-card">
        <div class="card-header">
          <div>
            <div class="card-title">Time Distribution</div>
            <div class="card-subtitle">Paid vs unpaid client discovery time for {{ currentPeriodData.periodLabel.toLowerCase() }}</div>
          </div>
        </div>

        <div class="card-body">
          <div class="time-donut-area mb-4">
            <div class="time-stack-bar">
              <div
                class="time-stack-segment bg-success"
                :style="{ flex: currentPeriodData.paidTimeMin || 0.01 }"
                :title="`Paid: ${currentPeriodData.paidTimeHM}`"
              ></div>
              <div
                class="time-stack-segment bg-warning"
                :style="{ flex: currentPeriodData.unpaidClientTimeMin || 0.01 }"
                :title="`Unpaid Client: ${currentPeriodData.unpaidClientTimeHM}`"
              ></div>
              <div
                class="time-stack-segment bg-blue"
                :style="{ flex: currentPeriodData.intentionalUnpaidTimeMin || 0.01 }"
                :title="`Intentional: ${currentPeriodData.intentionalUnpaidTimeHM}`"
              ></div>
            </div>
          </div>

          <div class="flex flex-col gap-2.5">
            <div class="value-row">
              <span class="value-row-label">
                <span class="time-legend-dot bg-success"></span>
                Paid Work Time
              </span>
              <span class="value-row-amount fw-600 text-success">{{ currentPeriodData.paidTimeHM }}</span>
            </div>
            <div class="value-row">
              <span class="value-row-label">
                <span class="time-legend-dot bg-warning"></span>
                Unpaid Client Discovery
              </span>
              <span class="value-row-amount fw-600 text-warning">{{ currentPeriodData.unpaidClientTimeHM }}</span>
            </div>
            <div class="value-row">
              <span class="value-row-label">
                <span class="time-legend-dot bg-blue"></span>
                Intentional Unpaid (Strategic/Learning)
              </span>
              <span class="value-row-amount fw-600 text-secondary">{{ currentPeriodData.intentionalUnpaidTimeHM }}</span>
            </div>
            <div class="value-row total pt-2 mt-1 border-t">
              <span class="value-row-label fw-700">Total Work Logged</span>
              <span class="value-row-amount fw-700 text-primary">{{ currentPeriodData.totalWorkTimeHM }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Work by Type Breakdown -->
      <div class="card" id="insights-work-type-card">
        <div class="card-header">
          <div>
            <div class="card-title">Work by Activity Type</div>
            <div class="card-subtitle">Time consumption across 10 service categories</div>
          </div>
        </div>

        <div class="card-body pt-2">
          <div v-if="currentPeriodData.typeBreakdown.length === 0" class="empty-state p-6">
            <div class="empty-desc">No sessions recorded in this timeframe.</div>
          </div>

          <div v-else class="work-type-list">
            <div
              v-for="item in currentPeriodData.typeBreakdown.slice(0, 6)"
              :key="item.type"
              class="work-type-row"
              :id="`type-row-${item.type}`"
            >
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="fw-600 capitalize text-primary flex items-center gap-1.5">
                  <span class="type-dot" :style="{ background: typeColors[item.type] || '#9CA3AF' }"></span>
                  {{ item.type }}
                </span>
                <span class="text-tertiary">
                  {{ item.durationHM }} · <strong class="text-secondary">{{ item.pctOfTotal }}%</strong>
                </span>
              </div>
              <div class="progress-bar-bg h-5">
                <div
                  class="progress-bar-fill"
                  :style="{
                    width: `${Math.max(4, item.pctOfTotal)}%`,
                    background: typeColors[item.type] || '#7A3FF6'
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 6: VALUE BY PROJECT BREAKDOWN TABLE -->
    <div class="card mb-6" id="insights-project-breakdown-card">
      <div class="card-header">
        <div>
          <div class="card-title">Project Value Breakdown</div>
          <div class="card-subtitle">Economic return, hours, and net effective rate per engagement</div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" id="table-project-breakdown">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Customer</th>
              <th class="table-text-right">Total Time</th>
              <th class="table-text-right">Paid Time</th>
              <th class="table-text-right">Unpaid Time</th>
              <th class="table-text-right">Revenue</th>
              <th class="table-text-right">Net Value</th>
              <th class="table-text-right">Effective Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in currentPeriodData.projectBreakdown"
              :key="p.id"
              @click="navigateTo(`/projects/${p.id}`)"
              class="cursor-pointer"
              :id="`proj-breakdown-row-${p.id}`"
            >
              <td>
                <div class="fw-600 text-sm">{{ p.name }}</div>
                <div class="text-tertiary text-xs">{{ p.isJob ? 'Revenue Job' : 'Project' }}</div>
              </td>
              <td class="text-secondary text-xs">{{ p.clientName }}</td>
              <td class="table-text-right fw-600 tabular">{{ p.totalHM }}</td>
              <td class="table-text-right fw-600 text-success tabular">{{ p.paidHM }}</td>
              <td class="table-text-right fw-600 text-warning tabular">{{ p.unpaidHM }}</td>
              <td class="table-text-right fw-600 text-success tabular">{{ store.fmtCurrency(p.revenue) }}</td>
              <td class="table-text-right fw-700 text-primary tabular">{{ store.fmtCurrency(p.netIncome) }}</td>
              <td class="table-text-right fw-700 text-brand tabular">
                {{ store.fmtHourly(p.effectiveHourly) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'

const store = useWelloStore()

const todayStr = new Date().toISOString().slice(0, 10)
function daysAgoStr(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

// Main Period Selector
const selectedPeriod = ref('month')
const customStartDate = ref(daysAgoStr(30))
const customEndDate = ref(todayStr)

const periodOptions = [
  { key: 'today',  label: 'Today' },
  { key: 'week',   label: 'This Week' },
  { key: 'month',  label: 'This Month' },
  { key: 'all',    label: 'All Time' },
  { key: 'custom', label: 'Custom' },
]

// Conversion Period Selector (Section 4)
const selectedConvPeriod = ref('all')
const convCustomStart = ref(daysAgoStr(30))
const convCustomEnd = ref(todayStr)

const convPeriodOptions = [
  { key: 'today',  label: 'Today' },
  { key: 'week',   label: 'This Week' },
  { key: 'month',  label: 'Month' },
  { key: 'all',    label: 'All' },
  { key: 'custom', label: 'Custom' },
]

// Trend Range Selector
const selectedTrendRange = ref('30d')
const trendOptions = [
  { key: '7d',  label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
]

// Work Type Palette (10 Work Types)
const typeColors = {
  meeting: '#7A3FF6',
  call: '#007BFF',
  discussion: '#FF9F1C',
  planning: '#FF387D',
  production: '#10B981',
  revision: '#F59E0B',
  delivery: '#059669',
  proposal: '#8B5CF6',
  travel: '#6B7280',
  other: '#9CA3AF',
}

// Current Period Analytics Data
const currentPeriodData = computed(() => {
  return store.getInsightsForPeriod(
    selectedPeriod.value,
    customStartDate.value,
    customEndDate.value
  )
})

// Conversion Data
const conversionData = computed(() => {
  return store.getConversionAnalysis(
    selectedConvPeriod.value,
    convCustomStart.value,
    convCustomEnd.value
  )
})

// Value Trend Data
const trendData = computed(() => {
  return store.getValueTrendSeries(selectedTrendRange.value)
})

const maxTrendRate = computed(() => {
  if (!trendData.value.points || trendData.value.points.length === 0) return 400
  const highest = Math.max(...trendData.value.points.map(p => p.rate), trendData.value.targetRate || 350)
  return Math.ceil((highest * 1.15) / 50) * 50
})

// Dynamic Smart Insights List
const dynamicInsightsList = computed(() => {
  return store.getDynamicSmartInsights(selectedPeriod.value)
})
</script>
