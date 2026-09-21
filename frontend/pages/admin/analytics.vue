<template>
  <div class="admin-analytics-command-center animate-fade-in">
    <!-- Page Header with Title, System Health Badge, and Live Anomaly Alert -->
    <div class="page-header">
      <div class="header-main">
        <h1 class="page-title">Platform Analytics Command Center</h1>
        <p class="page-subtitle">
          Enterprise operational telemetry across 50,000+ accounts, cohort retention matrices, work-value economics, and system observability.
        </p>
      </div>

      <div class="header-badges">
        <!-- Live System Health Badge -->
        <div v-if="overviewData?.systemHealth" class="health-badge" :class="overviewData.systemHealth.status.toLowerCase()">
          <span class="health-dot"></span>
          <span class="health-text">{{ overviewData.systemHealth.badge }}</span>
          <span class="health-latency">p95: {{ overviewData.systemHealth.avgLatencyMs }}ms</span>
        </div>

        <!-- Anomaly Signal Badge -->
        <div v-if="activeAnomalies.length > 0" class="anomaly-badge" @click="activeTab = 'tools'">
          <span class="anomaly-icon">⚡</span>
          <span>{{ activeAnomalies[0].message }}</span>
        </div>
      </div>
    </div>

    <!-- Universal Analytics Filter Bar -->
    <AdminAnalyticsFilterBar
      v-model="filters"
      :active-section="activeTab"
      @export="handleExport"
    />

    <!-- Operational Navigation Tabs (14 Sections) -->
    <div class="analytics-tabs-nav">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="tab-nav-btn"
        :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="analytics-loading-skeleton">
      <div class="skeleton-kpis">
        <div v-for="n in 4" :key="n" class="skeleton-card"></div>
      </div>
      <div class="skeleton-body"></div>
    </div>

    <!-- Tab Contents -->
    <div v-else class="tab-content-area">
      <!-- 1. OVERVIEW SECTION -->
      <div v-if="activeTab === 'overview'" class="tab-pane animate-fade-in">
        <!-- KPI Cards Grid (Row 1: Platform & Growth) -->
        <div class="kpi-grid">
          <AdminAnalyticsMetricCard
            label="Total Users"
            :value="overviewData?.kpis?.totalUsers?.value || 0"
            :tooltip="overviewData?.kpis?.totalUsers?.tooltip"
            :diff-percent="overviewData?.kpis?.totalUsers?.diffPercent"
            :sparkline-data="overviewData?.sparklines?.dau"
            drilldown-segment="activated"
            @drilldown="openDrilldown"
          />
          <AdminAnalyticsMetricCard
            label="New Signups"
            :value="overviewData?.kpis?.newSignups?.value || 0"
            :tooltip="overviewData?.kpis?.newSignups?.tooltip"
            :diff-percent="overviewData?.kpis?.newSignups?.diffPercent"
            :sparkline-data="overviewData?.sparklines?.signups"
          />
          <AdminAnalyticsMetricCard
            label="Active Now (15m)"
            :value="overviewData?.kpis?.activeNow?.value || 0"
            :tooltip="overviewData?.kpis?.activeNow?.tooltip"
          />
          <AdminAnalyticsMetricCard
            label="Platform Stickiness (DAU/MAU)"
            :value="overviewData?.kpis?.stickiness?.value || 0"
            unit="%"
            :tooltip="overviewData?.kpis?.stickiness?.tooltip"
            :diff-percent="overviewData?.kpis?.stickiness?.diffPercent"
          />
        </div>

        <!-- KPI Cards Grid (Row 2: Activation, Churn, Hours, Revenue) -->
        <div class="kpi-grid mt-4">
          <AdminAnalyticsMetricCard
            label="Activation Rate"
            :value="overviewData?.kpis?.activationRate?.value || 0"
            unit="%"
            :tooltip="overviewData?.kpis?.activationRate?.tooltip"
            :diff-percent="overviewData?.kpis?.activationRate?.diffPercent"
            drilldown-segment="activated"
            @drilldown="openDrilldown"
          />
          <AdminAnalyticsMetricCard
            label="30-Day Churn Rate"
            :value="overviewData?.kpis?.churnRate?.value || 0"
            unit="%"
            :tooltip="overviewData?.kpis?.churnRate?.tooltip"
            :reverse-diff-colors="true"
            drilldown-segment="churned"
            @drilldown="openDrilldown"
          />
          <AdminAnalyticsMetricCard
            label="Hours Tracked"
            :value="overviewData?.kpis?.hoursTracked?.value || 0"
            unit="h"
            :tooltip="overviewData?.kpis?.hoursTracked?.tooltip"
            :diff-percent="overviewData?.kpis?.hoursTracked?.diffPercent"
            :sparkline-data="overviewData?.sparklines?.hours"
          />
          <AdminAnalyticsMetricCard
            label="Revenue Recorded"
            :value="overviewData?.kpis?.revenueTrackedUsd?.value || 0"
            unit="$"
            :tooltip="overviewData?.kpis?.revenueTrackedUsd?.tooltip"
            :diff-percent="overviewData?.kpis?.revenueTrackedUsd?.diffPercent"
            :sparkline-data="overviewData?.sparklines?.revenue"
          />
        </div>

        <!-- Operational Queues & System Health Summary -->
        <div class="grid-2 gap-4 mt-6">
          <div class="analytics-card">
            <h4 class="card-title">Pending Operational Queues</h4>
            <div class="queues-list">
              <div class="queue-row" @click="openDrilldown('pending_deletion')">
                <span class="queue-name">GDPR Scheduled Deletions (30-day grace)</span>
                <span class="queue-badge alert">{{ overviewData?.queues?.pendingDeletions || 0 }}</span>
              </div>
              <div class="queue-row" @click="activeTab = 'operations'">
                <span class="queue-name">User Feedback Inbox</span>
                <span class="queue-badge info">{{ overviewData?.queues?.pendingFeedback || 0 }}</span>
              </div>
              <div class="queue-row" @click="activeTab = 'categories'">
                <span class="queue-name">Category Demand Backlog</span>
                <span class="queue-badge warning">{{ overviewData?.queues?.pendingCategoryRequests || 0 }}</span>
              </div>
            </div>
          </div>

          <div class="analytics-card">
            <h4 class="card-title">Activity Trend Summary</h4>
            <p class="card-desc">Active users and volume over selected window ({{ overviewData?.trendSeries?.length || 0 }} days aggregated)</p>
            <div class="trend-summary-stats">
              <div class="stat-box">
                <span class="stat-box-label">DAU Average</span>
                <span class="stat-box-val">{{ overviewData?.kpis?.dau?.value?.toLocaleString() || 0 }}</span>
              </div>
              <div class="stat-box">
                <span class="stat-box-label">WAU Rolling</span>
                <span class="stat-box-val">{{ overviewData?.kpis?.wau?.value?.toLocaleString() || 0 }}</span>
              </div>
              <div class="stat-box">
                <span class="stat-box-label">MAU Rolling</span>
                <span class="stat-box-val">{{ overviewData?.kpis?.mau?.value?.toLocaleString() || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. ACQUISITION & FUNNEL -->
      <div v-else-if="activeTab === 'funnel'" class="tab-pane animate-fade-in">
        <AdminAnalyticsFunnelChart
          :steps="funnelData?.steps || []"
          :title="funnelData?.funnel?.name"
          :description="funnelData?.funnel?.description"
          :overall-conversion-rate="funnelData?.funnel?.overallConversionRate"
        />

        <div class="grid-2 gap-4 mt-6">
          <AdminAnalyticsDataTable
            title="Acquisition Source & UTM Leaderboard"
            description="Conversion efficiency per acquisition channel"
            :columns="[
              { key: 'source', label: 'Campaign / Source' },
              { key: 'visits', label: 'Visits', align: 'right', format: 'number' },
              { key: 'signups', label: 'Signups', align: 'right', format: 'number' },
              { key: 'activations', label: 'Activations', align: 'right', format: 'number' },
              { key: 'conversionRate', label: 'Conv %', align: 'right', format: 'percent' },
            ]"
            :rows="funnelData?.utmLeaderboard || []"
          />

          <AdminAnalyticsDataTable
            title="Top Referring Domains"
            description="External referrers driving inbound visits"
            :columns="[
              { key: 'referrer', label: 'Referrer Domain' },
              { key: 'count', label: 'Visits Volume', align: 'right', format: 'number' },
            ]"
            :rows="funnelData?.referrerLeaderboard || []"
          />
        </div>
      </div>

      <!-- 3. RETENTION & COHORTS -->
      <div v-else-if="activeTab === 'retention'" class="tab-pane animate-fade-in">
        <AdminAnalyticsCohortHeatmap
          :cohorts="retentionData?.cohorts || []"
          :cohort-type="retentionData?.cohortType"
        />

        <div class="analytics-card mt-6">
          <h4 class="card-title">User Lifecycle Segments</h4>
          <p class="card-desc">Current breakdown of platform population across engagement stages</p>
          <div class="segments-grid mt-4">
            <div v-for="seg in retentionData?.lifecycleSegments" :key="seg.key" class="segment-box">
              <div class="segment-color-bar" :style="{ background: seg.color }"></div>
              <div class="segment-name">{{ seg.name }}</div>
              <div class="segment-count">{{ seg.count.toLocaleString() }} accounts</div>
              <div class="segment-pct">{{ seg.percentage }}% of users</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. ENGAGEMENT & FEATURE ADOPTION -->
      <div v-else-if="activeTab === 'engagement'" class="tab-pane animate-fade-in">
        <div class="analytics-card">
          <h4 class="card-title">Module & Feature Adoption Matrix (12 Core Modules)</h4>
          <p class="card-desc">Percentage of platform accounts actively utilizing each tool and interface module</p>

          <div class="modules-adoption-grid mt-4">
            <div v-for="m in engagementData?.moduleAdoption" :key="m.key" class="module-card">
              <div class="module-header">
                <span class="module-name">{{ m.name }}</span>
                <span class="module-pct">{{ m.adoptionPercent }}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: m.adoptionPercent + '%' }"></div>
              </div>
              <div class="module-meta">
                <span>{{ m.usersCount.toLocaleString() }} active users</span>
                <span v-if="m.totalRecords">{{ m.totalRecords.toLocaleString() }} records</span>
              </div>
            </div>
          </div>
        </div>

        <div class="analytics-card mt-6">
          <h4 class="card-title">Power-User Concentration</h4>
          <p class="card-desc">Distribution of logged work volume across top user deciles</p>
          <div class="grid-3 gap-4 mt-4">
            <div class="stat-box">
              <span class="stat-box-label">Top 10% Power Users</span>
              <span class="stat-box-val">{{ engagementData?.powerUserDistribution?.top10PercentShare }}%</span>
              <span class="stat-box-desc">of all tracked hours</span>
            </div>
            <div class="stat-box">
              <span class="stat-box-label">Top 20% Active Users</span>
              <span class="stat-box-val">{{ engagementData?.powerUserDistribution?.top20PercentShare }}%</span>
              <span class="stat-box-desc">of total logged work</span>
            </div>
            <div class="stat-box">
              <span class="stat-box-label">Cumulative Work Volume</span>
              <span class="stat-box-val">{{ engagementData?.powerUserDistribution?.totalHoursTracked }}h</span>
              <span class="stat-box-desc">across platform</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. WORK-VALUE PLATFORM INSIGHTS -->
      <div v-else-if="activeTab === 'work-value'" class="tab-pane animate-fade-in">
        <!-- Privacy rule notice badge -->
        <div class="privacy-badge mb-4">
          <span class="privacy-shield">🛡️</span>
          <span><strong>Privacy Rule Enforcement:</strong> Aggregate economic rates are calculated only for categories with at least 5 providers ($k \ge 5$). Slices below 5 providers are automatically redacted.</span>
        </div>

        <AdminAnalyticsDataTable
          title="Effective Rate vs Target Hourly by Category"
          description="USD-normalized provider realizations across taxonomy sectors"
          :columns="[
            { key: 'category', label: 'Category Sector' },
            { key: 'providerCount', label: 'Providers in Cohort', align: 'right', format: 'number' },
            { key: 'avgEffectiveRateUsd', label: 'Effective Rate ($/h)', align: 'right', format: 'currency' },
            { key: 'avgTargetHourlyUsd', label: 'Target Rate ($/h)', align: 'right', format: 'currency' },
            { key: 'rateRealizationPercent', label: 'Realization %', align: 'right', format: 'percent' },
          ]"
          :rows="workValueData?.ratesByCategory || []"
        />

        <div class="grid-2 gap-4 mt-6">
          <div class="analytics-card">
            <h4 class="card-title">Paid vs Unpaid Time & Leakage</h4>
            <div class="time-split-bar mt-3">
              <div class="paid-bar" :style="{ width: workValueData?.timeSplit?.paidPercent + '%' }">
                Paid: {{ workValueData?.timeSplit?.paidPercent }}% ({{ workValueData?.timeSplit?.paidHours }}h)
              </div>
              <div class="unpaid-bar" :style="{ width: workValueData?.timeSplit?.unpaidPercent + '%' }">
                Unpaid: {{ workValueData?.timeSplit?.unpaidPercent }}% ({{ workValueData?.timeSplit?.unpaidHours }}h)
              </div>
            </div>

            <h5 class="subhead mt-4">Top Causes of Unpaid Time Leakage</h5>
            <div class="leakage-list mt-2">
              <div v-for="l in workValueData?.leakageBreakdown" :key="l.reason" class="leakage-row">
                <span class="leakage-reason">{{ l.reason }}</span>
                <span class="leakage-hrs">{{ l.hours }}h ({{ l.percentage }}%)</span>
              </div>
            </div>
          </div>

          <div class="analytics-card">
            <h4 class="card-title">Income Mix & Quote Efficiency</h4>
            <div class="income-mix-list mt-3">
              <div v-for="im in workValueData?.incomeMix" :key="im.type" class="income-mix-row">
                <div class="mix-name">{{ im.label }}</div>
                <div class="mix-stats">
                  <span class="mix-pct">{{ im.percentage }}%</span>
                  <span class="mix-amt">${{ im.avgMonthlyUsd }}/mo avg</span>
                </div>
              </div>
            </div>

            <div class="economics-footer mt-4 pt-3 border-t">
              <div class="grid-2 gap-2 text-center">
                <div>
                  <span class="text-xs text-secondary">Quote Win Rate</span>
                  <div class="fw-700 text-lg text-primary">{{ workValueData?.quoteWinRatePercent }}%</div>
                </div>
                <div>
                  <span class="text-xs text-secondary">Avg Time-to-Money</span>
                  <div class="fw-700 text-lg text-primary">{{ workValueData?.avgTimeToMoneyDays }} days</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 6. CATEGORIES & TAXONOMY -->
      <div v-else-if="activeTab === 'categories'" class="tab-pane animate-fade-in">
        <div class="analytics-card mb-6">
          <h4 class="card-title">Taxonomy Performance & Provider Capacity</h4>
          <p class="card-desc">Active talent supply and completed contract throughput</p>
          <div class="categories-grid mt-4">
            <div v-for="c in categoriesData?.categories" :key="c.id" class="category-stat-card">
              <div class="cat-name">{{ c.name }}</div>
              <div class="cat-numbers">
                <span>{{ c.providersCount }} Providers</span>
                <span>•</span>
                <span>{{ c.activeJobs }} Active Jobs</span>
              </div>
              <div class="cat-growth">+{{ c.growthRatePercent }}% MoM</div>
            </div>
          </div>
        </div>

        <AdminAnalyticsDataTable
          title="Category Request Demand Queue"
          description="Crowdsourced taxonomy expansion requests from platform users"
          :columns="[
            { key: 'suggestedName', label: 'Requested Taxonomy Sector' },
            { key: 'voteCount', label: 'Demand Count / Votes', align: 'right', format: 'number' },
            { key: 'status', label: 'Status' },
            { key: 'createdAt', label: 'Requested Date', format: 'date' },
          ]"
          :rows="categoriesData?.requestQueue || []"
        />
      </div>

      <!-- 7. INVOICING INTELLIGENCE -->
      <div v-else-if="activeTab === 'invoicing'" class="tab-pane animate-fade-in">
        <div class="kpi-grid">
          <AdminAnalyticsMetricCard
            label="Invoices Created"
            :value="invoicingData?.summary?.invoicesCreated || 0"
            :tooltip="overviewData?.kpis?.invoicesPaid?.tooltip"
          />
          <AdminAnalyticsMetricCard
            label="Total Paid Volume"
            :value="invoicingData?.summary?.totalPaidAmountUsd || 0"
            unit="$"
          />
          <AdminAnalyticsMetricCard
            label="Overdue Volume"
            :value="invoicingData?.summary?.totalOverdueAmountUsd || 0"
            unit="$"
            :reverse-diff-colors="true"
          />
          <AdminAnalyticsMetricCard
            label="Average Days to Settle"
            :value="invoicingData?.summary?.avgDaysToPay || 0"
            unit="d"
          />
        </div>

        <div class="grid-2 gap-4 mt-6">
          <AdminAnalyticsDataTable
            title="Invoice Currency Mix"
            description="Multi-currency settlement volume normalized to USD"
            :columns="[
              { key: 'currency', label: 'Currency' },
              { key: 'volumeUsd', label: 'Volume (USD Eq)', align: 'right', format: 'currency' },
              { key: 'percentage', label: 'Share', align: 'right', format: 'percent' },
            ]"
            :rows="invoicingData?.currencyMix || []"
          />

          <AdminAnalyticsDataTable
            title="Top Invoicing Countries"
            description="Geographic distribution of outbound client invoices"
            :columns="[
              { key: 'country', label: 'Country' },
              { key: 'count', label: 'Invoices Count', align: 'right', format: 'number' },
              { key: 'volumeUsd', label: 'Total Volume', align: 'right', format: 'currency' },
            ]"
            :rows="invoicingData?.topCountries || []"
          />
        </div>
      </div>

      <!-- 8. ADDONS & FREE STORE -->
      <div v-else-if="activeTab === 'addons'" class="tab-pane animate-fade-in">
        <div class="kpi-grid mb-6">
          <div class="stat-box">
            <span class="stat-box-label">Store Visit &rarr; Install Conversion</span>
            <span class="stat-box-val">{{ addonsData?.storeVisitsConversionPercent }}%</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-label">Catalog Addons</span>
            <span class="stat-box-val">{{ addonsData?.addons?.length || 12 }}</span>
          </div>
        </div>

        <AdminAnalyticsDataTable
          title="Addon Store Activations & Utilization"
          description="Per-addon installation metrics, deactivations, and time-to-first-use"
          :columns="[
            { key: 'name', label: 'Addon Extension' },
            { key: 'category', label: 'Category' },
            { key: 'activeUsers', label: 'Active Users', align: 'right', format: 'number' },
            { key: 'deactivations', label: 'Deactivations', align: 'right', format: 'number' },
            { key: 'activationConversionRate', label: 'Install Rate', align: 'right', format: 'percent' },
            { key: 'unusedActivatedUsers', label: 'Unused / Inactive', align: 'right', format: 'number' },
          ]"
          :rows="addonsData?.addons || []"
        />

        <div class="analytics-card mt-6">
          <h4 class="card-title">Frequently Paired Extension Bundles</h4>
          <div class="bundles-list mt-3">
            <div v-for="b in addonsData?.topBundles" :key="b.bundle" class="bundle-row">
              <span class="bundle-name">📦 {{ b.bundle }}</span>
              <span class="bundle-count">{{ b.users }} active providers</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 9. GEOGRAPHY & DEVICES -->
      <div v-else-if="activeTab === 'geography'" class="tab-pane animate-fade-in">
        <div class="grid-2 gap-4">
          <AdminAnalyticsDataTable
            title="Geographic Ranking"
            description="User density and tracked revenue per sovereign jurisdiction"
            :columns="[
              { key: 'country', label: 'Country' },
              { key: 'users', label: 'Users', align: 'right', format: 'number' },
              { key: 'sessions', label: 'Sessions', align: 'right', format: 'number' },
              { key: 'hours', label: 'Hours', align: 'right', format: 'number' },
              { key: 'revenueUsd', label: 'Revenue (USD)', align: 'right', format: 'currency' },
            ]"
            :rows="geographyData?.countries || []"
          />

          <div class="analytics-card">
            <h4 class="card-title">Device & Platform Share</h4>
            <div class="device-breakdown mt-4">
              <h5 class="subhead">Device Types</h5>
              <div v-for="d in geographyData?.devices" :key="d.type" class="device-row">
                <span>{{ d.type }}</span>
                <span class="device-pct">{{ d.percentage }}% ({{ d.count }} users)</span>
              </div>

              <h5 class="subhead mt-4">Operating Systems</h5>
              <div v-for="os in geographyData?.operatingSystems" :key="os.os" class="device-row">
                <span>{{ os.os }}</span>
                <span class="device-pct">{{ os.percentage }}%</span>
              </div>

              <h5 class="subhead mt-4">PWA Installed Mode</h5>
              <div class="pwa-share-box mt-2">
                <strong>{{ geographyData?.pwaSharePercent }}%</strong> of active mobile users run Wello in PWA standalone mode.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 10. EMAIL & MESSAGING -->
      <div v-else-if="activeTab === 'messaging'" class="tab-pane animate-fade-in">
        <div class="kpi-grid">
          <AdminAnalyticsMetricCard
            label="Dispatched Emails"
            :value="messagingData?.summary?.sent || 0"
          />
          <AdminAnalyticsMetricCard
            label="Delivery Rate"
            :value="messagingData?.summary?.deliveryRatePercent || 0"
            unit="%"
          />
          <AdminAnalyticsMetricCard
            label="Open Rate"
            :value="messagingData?.summary?.openRatePercent || 0"
            unit="%"
          />
          <AdminAnalyticsMetricCard
            label="OTP Verification Success"
            :value="messagingData?.otpStats?.successRatePercent || 0"
            unit="%"
          />
        </div>

        <AdminAnalyticsDataTable
          class="mt-6"
          title="Recent Dispatches & Webhook Logs (Resend Integration)"
          :columns="[
            { key: 'recipient', label: 'Recipient' },
            { key: 'templateKey', label: 'Template' },
            { key: 'status', label: 'Delivery Status' },
            { key: 'deliveredAt', label: 'Delivered At', format: 'date' },
            { key: 'openedAt', label: 'Opened At', format: 'date' },
          ]"
          :rows="messagingData?.emailLogs || []"
        />
      </div>

      <!-- 11. SECURITY SIGNALS -->
      <div v-else-if="activeTab === 'security'" class="tab-pane animate-fade-in">
        <div class="kpi-grid mb-6">
          <div class="stat-box">
            <span class="stat-box-label">Failed Logins (24h)</span>
            <span class="stat-box-val">{{ securityData?.summary?.failedLogins24h || 0 }}</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-label">Rate-Limit Blocks</span>
            <span class="stat-box-val">{{ securityData?.summary?.rateLimitTriggers24h || 0 }}</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-label">Suspicious IPs</span>
            <span class="stat-box-val">{{ securityData?.summary?.suspiciousIpsCount || 0 }}</span>
          </div>
        </div>

        <div class="grid-2 gap-4">
          <AdminAnalyticsDataTable
            title="Suspicious IP Throttles"
            :columns="[
              { key: 'ip', label: 'IP Address' },
              { key: 'failedAttempts', label: 'Failures', align: 'right', format: 'number' },
              { key: 'lastAttempt', label: 'Last Block', format: 'date' },
            ]"
            :rows="securityData?.suspiciousIps || []"
          />

          <AdminAnalyticsDataTable
            title="Administrative Security Audit Log"
            :columns="[
              { key: 'action', label: 'Action Executed' },
              { key: 'admin', label: 'Admin User' },
              { key: 'timestamp', label: 'Timestamp', format: 'date' },
            ]"
            :rows="securityData?.recentSecurityAudit || []"
          />
        </div>
      </div>

      <!-- 12. SYSTEM HEALTH & OBSERVABILITY -->
      <div v-else-if="activeTab === 'system-health'" class="tab-pane animate-fade-in">
        <div class="kpi-grid mb-6">
          <div class="stat-box">
            <span class="stat-box-label">Uptime</span>
            <span class="stat-box-val text-success">{{ systemHealthData?.uptimePercent }}%</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-label">p50 Latency</span>
            <span class="stat-box-val">{{ systemHealthData?.p50LatencyMs }}ms</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-label">p95 Latency</span>
            <span class="stat-box-val">{{ systemHealthData?.p95LatencyMs }}ms</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-label">Error Rate</span>
            <span class="stat-box-val">{{ systemHealthData?.errorRatePercent }}%</span>
          </div>
        </div>

        <AdminAnalyticsDataTable
          title="API Route Latency Observability"
          description="Endpoint performance and response latency percentiles"
          :columns="[
            { key: 'route', label: 'API Route' },
            { key: 'p50', label: 'p50 Latency (ms)', align: 'right', format: 'number' },
            { key: 'p95', label: 'p95 Latency (ms)', align: 'right', format: 'number' },
            { key: 'errors', label: 'Errors Count', align: 'right', format: 'number' },
          ]"
          :rows="systemHealthData?.routesLatency || []"
        />
      </div>

      <!-- 13. SUPPORT & OPERATIONS -->
      <div v-else-if="activeTab === 'operations'" class="tab-pane animate-fade-in">
        <div class="grid-3 gap-4">
          <div class="analytics-card">
            <h4 class="card-title">GDPR Scheduled Deletions</h4>
            <div class="stat-big mt-3">{{ operationsData?.deletionBacklog?.pending || 0 }}</div>
            <p class="text-xs text-secondary mt-1">Accounts in 30-day grace period</p>
            <button class="btn-action mt-4" @click="openDrilldown('pending_deletion')">Inspect Queue</button>
          </div>

          <div class="analytics-card">
            <h4 class="card-title">User Feedback Queue</h4>
            <div class="stat-big mt-3">{{ operationsData?.feedbackInbox?.total || 0 }}</div>
            <p class="text-xs text-secondary mt-1">Pending user review items</p>
            <NuxtLink to="/admin/feedback" class="btn-action mt-4 inline-block text-center">Open Inbox</NuxtLink>
          </div>

          <div class="analytics-card">
            <h4 class="card-title">Category Backlog</h4>
            <div class="stat-big mt-3">{{ operationsData?.categoryRequestsBacklog?.pending || 0 }}</div>
            <p class="text-xs text-secondary mt-1">Taxonomy requests waiting for review</p>
            <button class="btn-action mt-4" @click="activeTab = 'categories'">Review Backlog</button>
          </div>
        </div>
      </div>

      <!-- 14. TOOLS & AUTOMATION -->
      <div v-else-if="activeTab === 'tools'" class="tab-pane animate-fade-in">
        <!-- Anomaly Detection Card -->
        <div class="analytics-card mb-6">
          <h4 class="card-title">Automated Anomaly Detection Engine</h4>
          <p class="card-desc">Alerts triggered when KPIs deviate by >15% from the rolling baseline</p>
          <div class="anomalies-list mt-4">
            <div v-for="a in activeAnomalies" :key="a.kpi" class="anomaly-row" :class="a.status">
              <div class="anomaly-left">
                <span class="anomaly-tag">{{ a.status.toUpperCase() }}</span>
                <strong>{{ a.kpi }}</strong>
                <span>{{ a.message }}</span>
              </div>
              <div class="anomaly-val">
                {{ a.changePercent > 0 ? '+' : '' }}{{ a.changePercent }}%
              </div>
            </div>
          </div>
        </div>

        <div class="grid-2 gap-4">
          <!-- Scheduled Reports -->
          <div class="analytics-card">
            <div class="flex items-center justify-between mb-3">
              <h4 class="card-title">Scheduled Email Digests</h4>
              <button class="btn-primary-sm" @click="openCreateReportModal">+ Schedule Report</button>
            </div>
            <p class="card-desc">Automated analytics snapshots dispatched to admin inboxes</p>

            <div v-if="scheduledReports.length === 0" class="empty-state">
              No scheduled reports active.
            </div>
            <div v-else class="reports-list mt-3">
              <div v-for="r in scheduledReports" :key="r.id" class="report-row">
                <div>
                  <strong>{{ r.reportName }}</strong>
                  <div class="text-xs text-secondary">{{ r.frequency }} &bull; {{ r.recipientEmails.join(', ') }}</div>
                </div>
                <button class="btn-delete" @click="deleteReport(r.id)">&times;</button>
              </div>
            </div>
          </div>

          <!-- Saved Views Manager -->
          <div class="analytics-card">
            <h4 class="card-title">Saved Analytical Presets</h4>
            <p class="card-desc">Custom filter sets saved by your admin account</p>

            <div v-if="savedViewsList.length === 0" class="empty-state">
              No saved views. Use the filter bar above to save your first view.
            </div>
            <div v-else class="views-list mt-3">
              <div v-for="v in savedViewsList" :key="v.id" class="view-item-row">
                <div>
                  <strong>{{ v.name }}</strong>
                  <div class="text-xs text-secondary">Section: {{ v.sectionKey }}</div>
                </div>
                <button class="btn-apply" @click="applyViewDirect(v)">Apply</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- User Drilldown Modal -->
    <AdminAnalyticsDrilldownModal
      :is-open="isDrilldownOpen"
      :segment-key="drilldownSegmentKey"
      :users="drilldownUsers"
      :loading="drilldownLoading"
      @close="isDrilldownOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import AdminAnalyticsFilterBar from '~/components/admin/AdminAnalyticsFilterBar.vue'
import type { AdminAnalyticsFilter } from '~/components/admin/AdminAnalyticsFilterBar.vue'
import AdminAnalyticsMetricCard from '~/components/admin/AdminAnalyticsMetricCard.vue'
import AdminAnalyticsFunnelChart from '~/components/admin/AdminAnalyticsFunnelChart.vue'
import AdminAnalyticsCohortHeatmap from '~/components/admin/AdminAnalyticsCohortHeatmap.vue'
import AdminAnalyticsDataTable from '~/components/admin/AdminAnalyticsDataTable.vue'
import AdminAnalyticsDrilldownModal from '~/components/admin/AdminAnalyticsDrilldownModal.vue'
import type { DrilldownUser } from '~/components/admin/AdminAnalyticsDrilldownModal.vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const activeTab = ref('overview')
const loading = ref(false)

const filters = reactive<AdminAnalyticsFilter>({
  range: '30d',
  compare: true,
  granularity: 'day',
  country: 'ALL',
  category: 'ALL',
  platform: 'ALL',
  utmSource: 'ALL',
  timezone: 'UTC',
})

const tabs = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'funnel', label: 'Funnel', icon: '⚡' },
  { key: 'retention', label: 'Retention', icon: '🔄' },
  { key: 'engagement', label: 'Engagement', icon: '🎯' },
  { key: 'work-value', label: 'Work-Value', icon: '💰' },
  { key: 'categories', label: 'Categories', icon: '🏷️' },
  { key: 'invoicing', label: 'Invoicing', icon: '🧾' },
  { key: 'addons', label: 'Addons & Store', icon: '🧩' },
  { key: 'geography', label: 'Geo & Devices', icon: '🌍' },
  { key: 'messaging', label: 'Messaging', icon: '✉️' },
  { key: 'security', label: 'Security', icon: '🔒' },
  { key: 'system-health', label: 'System Health', icon: '🩺' },
  { key: 'operations', label: 'Operations', icon: '📋' },
  { key: 'tools', label: 'Tools', icon: '⚙️' },
]

// Section State Containers
const overviewData = ref<any>(null)
const funnelData = ref<any>(null)
const retentionData = ref<any>(null)
const engagementData = ref<any>(null)
const workValueData = ref<any>(null)
const categoriesData = ref<any>(null)
const invoicingData = ref<any>(null)
const addonsData = ref<any>(null)
const geographyData = ref<any>(null)
const messagingData = ref<any>(null)
const securityData = ref<any>(null)
const systemHealthData = ref<any>(null)
const operationsData = ref<any>(null)
const activeAnomalies = ref<any[]>([])
const scheduledReports = ref<any[]>([])
const savedViewsList = ref<any[]>([])

// Drilldown Modal
const isDrilldownOpen = ref(false)
const drilldownSegmentKey = ref('activated')
const drilldownUsers = ref<DrilldownUser[]>([])
const drilldownLoading = ref(false)

function switchTab(tabKey: string) {
  activeTab.value = tabKey
  fetchActiveTabData()
}

function buildQueryString() {
  const p = new URLSearchParams()
  if (filters.range) p.set('range', filters.range)
  if (filters.startDate) p.set('startDate', filters.startDate)
  if (filters.endDate) p.set('endDate', filters.endDate)
  if (filters.compare !== undefined) p.set('compare', String(filters.compare))
  if (filters.granularity) p.set('granularity', filters.granularity)
  if (filters.country && filters.country !== 'ALL') p.set('country', filters.country)
  if (filters.category && filters.category !== 'ALL') p.set('category', filters.category)
  if (filters.platform && filters.platform !== 'ALL') p.set('platform', filters.platform)
  if (filters.utmSource && filters.utmSource !== 'ALL') p.set('utmSource', filters.utmSource)
  if (filters.timezone) p.set('timezone', filters.timezone)
  return p.toString()
}

async function fetchActiveTabData() {
  loading.value = true
  const qs = buildQueryString()

  try {
    switch (activeTab.value) {
      case 'overview': {
        const res = await fetch(`/api/admin/analytics/overview?${qs}`)
        if (res.ok) overviewData.value = await res.json()
        break
      }
      case 'funnel': {
        const res = await fetch(`/api/admin/analytics/funnel?${qs}`)
        if (res.ok) funnelData.value = await res.json()
        break
      }
      case 'retention': {
        const res = await fetch(`/api/admin/analytics/retention?${qs}`)
        if (res.ok) retentionData.value = await res.json()
        break
      }
      case 'engagement': {
        const res = await fetch(`/api/admin/analytics/engagement?${qs}`)
        if (res.ok) engagementData.value = await res.json()
        break
      }
      case 'work-value': {
        const res = await fetch(`/api/admin/analytics/work-value?${qs}`)
        if (res.ok) workValueData.value = await res.json()
        break
      }
      case 'categories': {
        const res = await fetch(`/api/admin/analytics/categories?${qs}`)
        if (res.ok) categoriesData.value = await res.json()
        break
      }
      case 'invoicing': {
        const res = await fetch(`/api/admin/analytics/invoicing?${qs}`)
        if (res.ok) invoicingData.value = await res.json()
        break
      }
      case 'addons': {
        const res = await fetch(`/api/admin/analytics/addons?${qs}`)
        if (res.ok) addonsData.value = await res.json()
        break
      }
      case 'geography': {
        const res = await fetch(`/api/admin/analytics/geography?${qs}`)
        if (res.ok) geographyData.value = await res.json()
        break
      }
      case 'messaging': {
        const res = await fetch(`/api/admin/analytics/messaging?${qs}`)
        if (res.ok) messagingData.value = await res.json()
        break
      }
      case 'security': {
        const res = await fetch(`/api/admin/analytics/security?${qs}`)
        if (res.ok) securityData.value = await res.json()
        break
      }
      case 'system-health': {
        const res = await fetch(`/api/admin/analytics/system-health?${qs}`)
        if (res.ok) systemHealthData.value = await res.json()
        break
      }
      case 'operations': {
        const res = await fetch(`/api/admin/analytics/operations?${qs}`)
        if (res.ok) operationsData.value = await res.json()
        break
      }
      case 'tools': {
        const [anomRes, schedRes, viewsRes] = await Promise.all([
          fetch('/api/admin/analytics/tools/anomalies'),
          fetch('/api/admin/analytics/tools/scheduled-reports'),
          fetch('/api/admin/analytics/tools/saved-views'),
        ])
        if (anomRes.ok) activeAnomalies.value = (await anomRes.json()).anomalies || []
        if (schedRes.ok) scheduledReports.value = (await schedRes.json()).reports || []
        if (viewsRes.ok) savedViewsList.value = (await viewsRes.json()).views || []
        break
      }
    }
  } catch (err) {
    console.error('Failed to load tab data:', err)
  } finally {
    loading.value = false
  }
}

async function openDrilldown(segmentKey: string) {
  drilldownSegmentKey.value = segmentKey
  isDrilldownOpen.value = true
  drilldownLoading.value = true
  try {
    const qs = buildQueryString()
    const res = await fetch(`/api/admin/analytics/tools/drilldown?segmentKey=${segmentKey}&${qs}`)
    if (res.ok) {
      const data = await res.json()
      drilldownUsers.value = data.users || []
    }
  } catch (err) {
    console.error('Failed to fetch drilldown users', err)
  } finally {
    drilldownLoading.value = false
  }
}

function handleExport(format: 'csv' | 'json') {
  const qs = buildQueryString()
  const url = `/api/admin/analytics/export?section=${activeTab.value}&format=${format}&${qs}`
  window.open(url, '_blank')
}

async function deleteReport(id: number) {
  try {
    const res = await fetch(`/api/admin/analytics/tools/scheduled-reports?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      scheduledReports.value = scheduledReports.value.filter(r => r.id !== id)
    }
  } catch (err) {
    console.error('Failed to delete scheduled report', err)
  }
}

function applyViewDirect(view: any) {
  if (view.filters) {
    Object.assign(filters, view.filters)
  }
}

function openCreateReportModal() {
  const reportName = prompt('Enter report name (e.g. Weekly Executive Summary):', 'Weekly Executive Digest')
  if (!reportName) return
  const email = prompt('Enter recipient email:', 'admin@wello.com')
  if (!email) return

  fetch('/api/admin/analytics/tools/scheduled-reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reportName,
      frequency: 'weekly',
      recipientEmails: [email],
      sections: ['overview', 'funnel', 'invoicing'],
    }),
  }).then(async (res) => {
    if (res.ok) {
      const data = await fetch('/api/admin/analytics/tools/scheduled-reports').then(r => r.json())
      scheduledReports.value = data.reports || []
    }
  })
}

watch(
  filters,
  () => {
    fetchActiveTabData()
  },
  { deep: true }
)

onMounted(async () => {
  await fetchActiveTabData()
  // Fetch anomalies for top banner
  try {
    const aRes = await fetch('/api/admin/analytics/tools/anomalies')
    if (aRes.ok) activeAnomalies.value = (await aRes.json()).anomalies || []
  } catch {
    // Ignore
  }
})
</script>

<style scoped>
.admin-analytics-command-center {
  padding: 24px;
  max-width: 1440px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
  margin: 0 0 4px 0;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  max-width: 700px;
  margin: 0;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.health-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.health-badge.operational {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.health-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.health-latency {
  color: #065f46;
  font-size: 0.6875rem;
  background: rgba(4, 120, 87, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.anomaly-badge {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #b45309;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.analytics-tabs-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 12px;
  margin-bottom: 24px;
  border-bottom: 1px solid #e2e8f0;
}

.tab-nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: #f8fafc;
  color: #475569;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.tab-nav-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.tab-nav-btn.active {
  background: #0d9488;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(13, 148, 136, 0.25);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.analytics-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 2px 0;
}

.card-desc {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
}

.queues-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}

.queue-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 8px;
  background: #f8fafc;
  cursor: pointer;
  transition: background 0.15s;
}

.queue-row:hover {
  background: #f1f5f9;
}

.queue-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
}

.queue-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
}

.queue-badge.alert { background: #fef2f2; color: #dc2626; }
.queue-badge.info { background: #eff6ff; color: #2563eb; }
.queue-badge.warning { background: #fffbeb; color: #d97706; }

.trend-summary-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 16px;
}

.stat-box {
  background: #f8fafc;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-box-label {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 600;
}

.stat-box-val {
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
}

.stat-box-desc {
  font-size: 0.6875rem;
  color: #94a3b8;
}

.stat-big {
  font-size: 2.25rem;
  font-weight: 800;
  color: #0f172a;
}

.btn-action {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.btn-action:hover {
  background: #0d9488;
  color: #ffffff;
}

.segments-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.segment-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  position: relative;
  overflow: hidden;
}

.segment-color-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.segment-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 6px;
}

.segment-count {
  font-size: 1.125rem;
  font-weight: 800;
  color: #0f172a;
}

.segment-pct {
  font-size: 0.75rem;
  color: #64748b;
}

.modules-adoption-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.module-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
}

.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.module-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
}

.module-pct {
  font-size: 0.875rem;
  font-weight: 800;
  color: #0d9488;
}

.progress-track {
  width: 100%;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: #0d9488;
  border-radius: 3px;
}

.module-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: #64748b;
}

.privacy-badge {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.8125rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.privacy-shield {
  font-size: 1.25rem;
}

.time-split-bar {
  display: flex;
  height: 36px;
  border-radius: 6px;
  overflow: hidden;
  font-size: 0.75rem;
  font-weight: 700;
  color: #ffffff;
}

.paid-bar {
  background: #0d9488;
  display: flex;
  align-items: center;
  padding: 0 12px;
}

.unpaid-bar {
  background: #f59e0b;
  display: flex;
  align-items: center;
  padding: 0 12px;
}

.leakage-list, .income-mix-list, .bundles-list, .reports-list, .views-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leakage-row, .income-mix-row, .bundle-row, .report-row, .view-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 0.8125rem;
}

.subhead {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.category-stat-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
}

.cat-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 4px;
}

.cat-numbers {
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.cat-growth {
  font-size: 0.75rem;
  font-weight: 700;
  color: #059669;
}

.device-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.8125rem;
}

.pwa-share-box {
  background: #f0fdfa;
  border: 1px solid #ccfbf1;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #0f766e;
}

.anomalies-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.anomaly-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.anomaly-row.surge { background: #ecfdf5; border: 1px solid #a7f3d0; }
.anomaly-row.drop { background: #fef2f2; border: 1px solid #fecaca; }
.anomaly-row.stable { background: #f8fafc; border: 1px solid #e2e8f0; }

.anomaly-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.anomaly-tag {
  font-size: 0.6875rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  background: #ffffff;
}

.anomaly-val {
  font-weight: 800;
  font-size: 0.875rem;
}

.btn-primary-sm {
  background: #0d9488;
  color: #ffffff;
  border: none;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-delete {
  background: none;
  border: none;
  color: #ef4444;
  font-size: 1.25rem;
  cursor: pointer;
}

.btn-apply {
  background: #0d9488;
  color: #ffffff;
  border: none;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.6875rem;
  cursor: pointer;
}

.analytics-loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.skeleton-card {
  height: 110px;
  background: #f1f5f9;
  border-radius: 12px;
  animation: pulse 1.5s infinite;
}

.skeleton-body {
  height: 380px;
  background: #f1f5f9;
  border-radius: 12px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (max-width: 1024px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .modules-adoption-grid, .categories-grid, .segments-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
  .modules-adoption-grid, .categories-grid, .segments-grid {
    grid-template-columns: 1fr;
  }
}
</style>
