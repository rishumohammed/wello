<template>
  <div class="calculator-page animate-fade-in flex flex-col gap-6">
    <!-- Page Header -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <div class="badge badge-purple text-xs fw-700">Actionable Intelligence</div>
          <span class="text-tertiary text-xs">· Data-Backed Quoting</span>
        </div>
        <h1 class="page-title">Pricing & Quote Calculator</h1>
        <p class="page-subtitle">
          Price projects accurately to protect your target hourly rate. Automatically incorporates your historical unpaid buffer, allocated overhead, and past similar job benchmarks.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          @click="resetCalculator"
          id="btn-calc-reset"
        >
          Reset Defaults
        </button>
      </div>
    </div>

    <!-- Main 2-Column Grid -->
    <div class="grid-1 lg:grid-12 gap-6 items-start">
      <!-- LEFT COLUMN: Parameter Controls (5 cols) -->
      <div class="lg:col-span-5 flex flex-col gap-5">
        <div class="card" id="card-calc-inputs">
          <div class="card-header flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="metric-icon-box purple">
                <IconCalculator :size="16" />
              </div>
              <div>
                <div class="card-title text-base">Project Parameters</div>
                <div class="card-subtitle text-xs">Configure your scope, rates, and buffers</div>
              </div>
            </div>
          </div>

          <div class="card-body flex flex-col gap-4">
            <!-- Project Link Option -->
            <div class="form-group">
              <label class="form-label" for="calc-project-select">
                Link to Existing Project (Optional)
              </label>
              <select
                id="calc-project-select"
                v-model="selectedProjectId"
                class="form-select"
                @change="handleProjectSelect"
              >
                <option value="">-- Standalone New Estimate --</option>
                <option v-for="p in activeProjects" :key="p.id" :value="p.id">
                  {{ p.name }} ({{ getClientName(p.clientId) }})
                </option>
              </select>
              <span class="form-hint">
                Linking pre-fills estimates and allows one-click applying of quotes directly.
              </span>
            </div>

            <!-- Service Category & Complexity -->
            <div class="grid-2 gap-3">
              <div class="form-group">
                <label class="form-label" for="calc-category">Service Category</label>
                <select id="calc-category" v-model="form.serviceCategory" class="form-select" @change="recalculate">
                  <option value="Web Development">Web Development</option>
                  <option value="Design & Development">Design & Development</option>
                  <option value="Consulting">Consulting & Strategy</option>
                  <option value="Mobile Development">Mobile Apps</option>
                  <option value="Branding">Branding & Identity</option>
                  <option value="Maintenance">Maintenance & Retainer</option>
                  <option value="Other">General Freelance</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="calc-complexity">Scope Complexity</label>
                <select id="calc-complexity" v-model="form.complexity" class="form-select" @change="recalculate">
                  <option value="standard">Standard Scope</option>
                  <option value="complex">High Complexity (+15% buffer)</option>
                  <option value="rush">Rush / Priority (+25% premium)</option>
                </select>
              </div>
            </div>

            <!-- Target Hourly Benchmark -->
            <div class="form-group">
              <div class="flex items-center justify-between">
                <label class="form-label mb-0" for="calc-target-rate">
                  Target Hourly Benchmark ({{ baseCurrency }})
                </label>
                <span class="text-2xs text-purple fw-600">Your Base Rate</span>
              </div>
              <div class="input-with-currency mt-1">
                <input
                  id="calc-target-rate"
                  v-model.number="form.targetHourlyRate"
                  type="number"
                  min="1"
                  step="5"
                  class="form-input"
                  @input="recalculate"
                />
              </div>
            </div>

            <!-- Estimated Hours Slider & Input -->
            <div class="form-group">
              <div class="flex items-center justify-between">
                <label class="form-label mb-0" for="calc-est-hours">
                  Estimated Active Work Hours
                </label>
                <span class="text-xs fw-700 text-primary">{{ form.estimatedHours }} hrs</span>
              </div>
              <div class="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  v-model.number="form.estimatedHours"
                  min="1"
                  max="300"
                  step="1"
                  class="range-slider flex-1"
                  @input="recalculate"
                />
                <input
                  id="calc-est-hours"
                  v-model.number="form.estimatedHours"
                  type="number"
                  min="1"
                  max="1000"
                  class="form-input w-24 text-center"
                  @input="recalculate"
                />
              </div>
            </div>

            <!-- Unpaid Buffer % (Defaulted from Historical Unpaid Ratio) -->
            <div class="form-group p-3 bg-off-white rounded-12 border-subtle-box">
              <div class="flex items-center justify-between mb-1">
                <label class="form-label mb-0" for="calc-unpaid-buffer">
                  Unpaid Time Buffer (%)
                </label>
                <span class="text-xs fw-700 text-warning">{{ form.unpaidBufferPercent }}% buffer</span>
              </div>
              <div class="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  v-model.number="form.unpaidBufferPercent"
                  min="0"
                  max="100"
                  step="1"
                  class="range-slider flex-1"
                  @input="recalculate"
                />
                <input
                  id="calc-unpaid-buffer"
                  v-model.number="form.unpaidBufferPercent"
                  type="number"
                  min="0"
                  max="200"
                  class="form-input w-20 text-center"
                  @input="recalculate"
                />
              </div>
              <div class="text-2xs text-tertiary mt-2 flex items-center justify-between">
                <span>Defaulted from your historical unpaid ratio ({{ historicalUnpaidRatio }}%)</span>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs text-purple p-0"
                  @click="resetBufferToHistorical"
                >
                  Reset to {{ historicalUnpaidRatio }}%
                </button>
              </div>
            </div>

            <!-- Expected Overhead Allocation ($) -->
            <div class="form-group">
              <div class="flex items-center justify-between">
                <label class="form-label mb-0" for="calc-overhead">
                  Allocated Business Overhead ({{ baseCurrency }})
                </label>
                <span class="text-2xs text-tertiary">Software, tools & utilities</span>
              </div>
              <input
                id="calc-overhead"
                v-model.number="form.expectedOverhead"
                type="number"
                min="0"
                step="10"
                class="form-input mt-1"
                placeholder="e.g. 150"
                @input="recalculate"
              />
            </div>

            <!-- Direct Project Expenses ($) -->
            <div class="form-group">
              <div class="flex items-center justify-between">
                <label class="form-label mb-0" for="calc-expenses">
                  Direct Project Expenses / Pass-Through ({{ baseCurrency }})
                </label>
                <span class="text-2xs text-tertiary">Third-party assets, hosting, licenses</span>
              </div>
              <input
                id="calc-expenses"
                v-model.number="form.directExpenses"
                type="number"
                min="0"
                step="25"
                class="form-input mt-1"
                placeholder="e.g. 200"
                @input="recalculate"
              />
            </div>

            <!-- Profit Margin Target Slider -->
            <div class="form-group">
              <div class="flex items-center justify-between">
                <label class="form-label mb-0" for="calc-margin">
                  Target Profit Margin (%)
                </label>
                <span class="text-xs fw-700 text-success">+{{ form.targetMarginPercent }}% margin</span>
              </div>
              <div class="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  v-model.number="form.targetMarginPercent"
                  min="0"
                  max="60"
                  step="5"
                  class="range-slider flex-1"
                  @input="recalculate"
                />
                <span class="text-xs fw-600 text-tertiary w-12 text-right">{{ form.targetMarginPercent }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Calculated Quotes, Breakdown & Benchmarking (7 cols) -->
      <div class="lg:col-span-7 flex flex-col gap-5">
        <!-- Quote Recommendations Hero Card -->
        <div class="card quote-hero-card" id="card-quote-recommendations">
          <div class="card-body p-6">
            <div class="text-xs fw-700 uppercase text-purple tracking-wide mb-1">
              Data-Backed Quote Recommendation
            </div>
            <div class="text-xs text-tertiary mb-5">
              Based on {{ form.estimatedHours }}h estimated scope + {{ form.unpaidBufferPercent }}% unpaid buffer at {{ fmtCurrency(form.targetHourlyRate) }}/h benchmark
            </div>

            <div class="grid-1 md:grid-2 gap-4">
              <!-- Minimum Breakeven Quote -->
              <div class="quote-box min-quote-box p-4 rounded-14 border flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs fw-700 text-secondary uppercase">Minimum Quote</span>
                    <span class="badge badge-warning text-2xs fw-700">Breakeven</span>
                  </div>
                  <div class="text-2xs text-tertiary mb-3">
                    Covers target rate, unpaid buffer & all expenses with 0% margin.
                  </div>
                  <div class="quote-amount text-2xl font-extrabold text-primary" id="calc-min-quote-amount">
                    {{ fmtCurrency(calcResults.suggestedMinQuote) }}
                  </div>
                </div>

                <div class="mt-4 pt-3 border-t text-2xs text-tertiary flex items-center justify-between">
                  <span>Effective at est. hours:</span>
                  <strong class="text-primary">{{ fmtCurrency(calcResults.minEffectiveRate) }}/h</strong>
                </div>
              </div>

              <!-- Recommended Target Quote -->
              <div class="quote-box target-quote-box p-4 rounded-14 border flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs fw-700 text-purple uppercase">Target Quote</span>
                    <span class="badge badge-purple text-2xs fw-700">Recommended</span>
                  </div>
                  <div class="text-2xs text-purple-subtle mb-3">
                    Includes +{{ form.targetMarginPercent }}% profit cushion for revisions and contingencies.
                  </div>
                  <div class="quote-amount text-3xl font-extrabold text-purple" id="calc-target-quote-amount">
                    {{ fmtCurrency(calcResults.suggestedTargetQuote) }}
                  </div>
                </div>

                <div class="mt-4 pt-3 border-t border-purple-subtle text-2xs text-secondary flex items-center justify-between">
                  <span>Effective at est. hours:</span>
                  <strong class="text-purple">{{ fmtCurrency(calcResults.targetEffectiveRate) }}/h</strong>
                </div>
              </div>
            </div>

            <!-- Action Bar: Apply Quote CTA -->
            <div class="mt-6 pt-4 border-t flex items-center justify-between flex-wrap gap-3">
              <div class="text-xs text-tertiary">
                <span v-if="selectedProject">
                  Selected: <strong>{{ selectedProject.name }}</strong>
                </span>
                <span v-else>
                  Select a project to apply this quote with 1 click.
                </span>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  @click="openApplyModal('min')"
                  id="btn-apply-min-quote"
                >
                  Use Minimum ({{ fmtCurrency(calcResults.suggestedMinQuote) }})
                </button>
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  @click="openApplyModal('target')"
                  id="btn-apply-target-quote"
                >
                  <IconCheck :size="14" />
                  <span>Use Target Quote ({{ fmtCurrency(calcResults.suggestedTargetQuote) }})</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Quote Math Breakdown Breakdown Card -->
        <div class="card" id="card-quote-breakdown">
          <div class="card-header flex items-center justify-between">
            <div class="card-title text-sm">Quote Calculation Breakdown</div>
            <span class="text-2xs text-tertiary">Transparent Cost Ledger</span>
          </div>

          <div class="card-body p-4">
            <div class="table-container">
              <table class="data-table text-xs">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Calculation Formula</th>
                    <th class="text-right">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="fw-600 text-primary">Direct Active Labor</td>
                    <td class="text-tertiary">{{ form.estimatedHours }} hrs × {{ fmtCurrency(form.targetHourlyRate) }}/h</td>
                    <td class="text-right fw-600">{{ fmtCurrency(calcResults.baseLaborCost) }}</td>
                  </tr>
                  <tr>
                    <td class="fw-600 text-warning">Unpaid Buffer Protection</td>
                    <td class="text-tertiary">{{ form.unpaidBufferPercent }}% buffer ({{ calcResults.bufferHours }} hrs)</td>
                    <td class="text-right fw-600 text-warning">+{{ fmtCurrency(calcResults.bufferCost) }}</td>
                  </tr>
                  <tr v-if="form.expectedOverhead > 0">
                    <td class="fw-600 text-secondary">Allocated Business Overhead</td>
                    <td class="text-tertiary">Pro-rated tool & workspace expenses</td>
                    <td class="text-right fw-600">+{{ fmtCurrency(form.expectedOverhead) }}</td>
                  </tr>
                  <tr v-if="form.directExpenses > 0">
                    <td class="fw-600 text-secondary">Direct Project Expenses</td>
                    <td class="text-tertiary">Pass-through contractor & software costs</td>
                    <td class="text-right fw-600">+{{ fmtCurrency(form.directExpenses) }}</td>
                  </tr>
                  <tr class="bg-off-white fw-700">
                    <td class="text-primary">Minimum Breakeven Quote</td>
                    <td class="text-tertiary">Total baseline delivery cost</td>
                    <td class="text-right text-primary">{{ fmtCurrency(calcResults.suggestedMinQuote) }}</td>
                  </tr>
                  <tr class="fw-700 text-purple">
                    <td>Target Margin (+{{ form.targetMarginPercent }}%)</td>
                    <td class="text-tertiary">Contingency profit & revision cushion</td>
                    <td class="text-right">+{{ fmtCurrency(calcResults.marginAmount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Historical Benchmarking: "Your last 5 similar jobs actually earned $X/hr" -->
        <div class="card" id="card-calc-benchmarks">
          <div class="card-header flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="metric-icon-box blue">
                <IconInsights :size="16" />
              </div>
              <div>
                <div class="card-title text-sm">Historical Similar Jobs Benchmark</div>
                <div class="card-subtitle text-2xs">Realized performance in {{ form.serviceCategory }}</div>
              </div>
            </div>
            <span v-if="similarJobs.length > 0" class="badge badge-info text-2xs fw-700">
              {{ similarJobs.length }} Past Jobs Analyzed
            </span>
          </div>

          <div class="card-body p-4">
            <!-- Benchmark Summary Callout -->
            <div v-if="similarJobs.length > 0" class="p-4 bg-off-white rounded-12 border-subtle-box mb-4">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div class="text-2xs text-tertiary uppercase fw-600">Actual Realized Rate</div>
                  <div class="text-lg fw-800 text-primary mt-0.5">
                    Your last {{ similarJobs.length }} similar jobs earned
                    <span class="text-purple">{{ fmtCurrency(medianEarnedRate) }}/hour</span>
                    effective
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <span
                    class="badge text-xs fw-700"
                    :class="medianEarnedRate >= form.targetHourlyRate ? 'badge-success' : 'badge-warning'"
                  >
                    {{ medianEarnedRate >= form.targetHourlyRate ? 'Above Target' : 'Below Target Benchmark' }}
                  </span>
                </div>
              </div>
              <p class="text-xs text-secondary mt-2 mb-0">
                {{ benchmarkInsightText }}
              </p>
            </div>

            <div v-else class="p-6 text-center text-tertiary bg-off-white rounded-12">
              <IconBriefcase :size="24" class="mx-auto opacity-40 mb-2" />
              <div class="fw-600 text-xs text-secondary">No completed jobs in this category yet</div>
              <div class="text-2xs mt-1">As you log sessions and collect payments, Wello benchmarks future quotes automatically.</div>
            </div>

            <!-- Similar Jobs Table -->
            <div v-if="similarJobs.length > 0" class="table-container">
              <table class="data-table text-xs">
                <thead>
                  <tr>
                    <th>Past Project</th>
                    <th>Quoted / Revenue</th>
                    <th>Hours Tracked</th>
                    <th class="text-right">Realized Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="job in similarJobs" :key="job.id">
                    <td>
                      <div class="fw-600 text-primary">{{ job.name }}</div>
                      <div class="text-2xs text-tertiary">{{ job.clientName || 'Client' }}</div>
                    </td>
                    <td>
                      <div class="fw-600 text-primary">{{ fmtCurrency(job.revenue || job.quoteAmount || 0) }}</div>
                      <div class="text-2xs text-tertiary">{{ job.status }}</div>
                    </td>
                    <td>
                      <div class="fw-600 text-secondary">{{ (job.totalHours || 0).toFixed(1) }} hrs</div>
                      <div class="text-2xs text-tertiary">{{ Math.round((job.unpaidRatio || 0) * 100) }}% unpaid</div>
                    </td>
                    <td class="text-right">
                      <div class="fw-700" :class="(job.effectiveHourly || 0) >= form.targetHourlyRate ? 'text-success' : 'text-warning'">
                        {{ fmtCurrency(job.effectiveHourly || 0) }}/h
                      </div>
                      <div class="text-2xs text-tertiary">
                        {{ (job.effectiveHourly || 0) >= form.targetHourlyRate ? '✓ met target' : '⚠ rate leakage' }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Apply Quote to Project -->
    <div v-if="showApplyModal" class="modal-backdrop">
      <div class="modal-box p-6 bg-card rounded-16 max-w-md w-full shadow-soft-xl animate-scale-in">
        <div class="flex items-center justify-between mb-4">
          <div class="fw-700 text-base text-primary">Apply Calculated Quote</div>
          <button class="btn btn-ghost btn-xs" @click="showApplyModal = false">✕</button>
        </div>

        <div class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label" for="modal-apply-project">Target Project <span class="required">*</span></label>
            <select id="modal-apply-project" v-model="applyTargetProjectId" class="form-select">
              <option value="" disabled>-- Select Project --</option>
              <option v-for="p in activeProjects" :key="p.id" :value="p.id">
                {{ p.name }} ({{ getClientName(p.clientId) }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="modal-quote-amount">Quote Amount ({{ baseCurrency }}) <span class="required">*</span></label>
            <input
              id="modal-quote-amount"
              v-model.number="applyQuoteAmount"
              type="number"
              step="10"
              class="form-input text-lg font-bold text-purple"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="modal-quote-hours">Estimated Hours</label>
            <input
              id="modal-quote-hours"
              v-model.number="applyEstHours"
              type="number"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="modal-quote-notes">Quote Notes / Rationale</label>
            <textarea
              id="modal-quote-notes"
              v-model="applyQuoteNotes"
              rows="3"
              class="form-input text-xs"
              placeholder="Rationale from calculator breakdown..."
            ></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
          <button class="btn btn-secondary btn-sm" @click="showApplyModal = false">Cancel</button>
          <button
            class="btn btn-primary btn-sm"
            @click="confirmApplyQuote"
            id="btn-confirm-apply-quote"
            :disabled="!applyTargetProjectId || isApplying"
          >
            {{ isApplying ? 'Applying...' : 'Apply Quote to Project' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'
import IconCalculator from '~/components/IconCalculator.vue'
import IconCheck from '~/components/IconCheck.vue'
import IconInsights from '~/components/IconInsights.vue'
import IconBriefcase from '~/components/IconBriefcase.vue'

const store = useWelloStore()
const toast = useToast()
const router = useRouter()
const route = useRoute()

const baseCurrency = computed(() => store.user?.baseCurrency || 'USD')
const activeProjects = computed(() => store.projects.filter(p => p.status !== 'archived'))

const selectedProjectId = ref('')
const isApplying = ref(false)
const showApplyModal = ref(false)
const applyTargetProjectId = ref('')
const applyQuoteAmount = ref(0)
const applyEstHours = ref(0)
const applyQuoteNotes = ref('')

// Historical Unpaid Ratio from user's tracked sessions
const historicalUnpaidRatio = computed(() => {
  const totalMin = store.sessions.reduce((acc, s) => acc + (s.durationMin || 0), 0)
  const unpaidMin = store.sessions.reduce((acc, s) => acc + (s.isUnpaid ? (s.durationMin || 0) : 0), 0)
  if (!totalMin || totalMin <= 0) return 20 // 20% standard baseline
  return Math.max(5, Math.round((unpaidMin / totalMin) * 100))
})

// Form Inputs
const form = ref({
  targetHourlyRate: store.user?.targetHourly || 100,
  estimatedHours: 40,
  unpaidBufferPercent: 20,
  expectedOverhead: 100,
  directExpenses: 0,
  targetMarginPercent: 20,
  serviceCategory: 'Web Development',
  complexity: 'standard',
})

const selectedProject = computed(() => {
  if (!selectedProjectId.value) return null
  return store.projects.find(p => String(p.id) === String(selectedProjectId.value)) || null
})

// Calculated Results
const calcResults = computed(() => {
  const H = Number(form.value.estimatedHours) || 1
  const T = Number(form.value.targetHourlyRate) || 0
  const B = Number(form.value.unpaidBufferPercent) || 0
  const OH = Number(form.value.expectedOverhead) || 0
  const E = Number(form.value.directExpenses) || 0
  const M = Number(form.value.targetMarginPercent) || 0

  let complexityMultiplier = 1.0
  if (form.value.complexity === 'complex') complexityMultiplier = 1.15
  if (form.value.complexity === 'rush') complexityMultiplier = 1.25

  const baseLaborCost = Math.round(H * T)
  const bufferHours = Number(((H * (B / 100))).toFixed(1))
  const bufferCost = Math.round(bufferHours * T)
  const totalLaborCost = baseLaborCost + bufferCost

  const baseMinQuote = (totalLaborCost + OH + E) * complexityMultiplier
  const suggestedMinQuote = Math.ceil(baseMinQuote / 10) * 10

  const marginAmount = Math.round(suggestedMinQuote * (M / 100))
  const suggestedTargetQuote = Math.ceil((suggestedMinQuote + marginAmount) / 10) * 10

  const minEffectiveRate = H > 0 ? Math.round(suggestedMinQuote / H) : 0
  const targetEffectiveRate = H > 0 ? Math.round(suggestedTargetQuote / H) : 0

  return {
    baseLaborCost,
    bufferHours,
    bufferCost,
    totalLaborCost,
    suggestedMinQuote,
    suggestedTargetQuote,
    marginAmount,
    minEffectiveRate,
    targetEffectiveRate,
  }
})

// Historical Similar Jobs Benchmarking
const similarJobs = computed(() => {
  const category = form.value.serviceCategory
  const matched = store.projects
    .filter(p => p.serviceCategory === category || (!p.serviceCategory && category === 'Web Development'))
    .map(p => {
      const pSessions = store.sessions.filter(s => String(s.projectId) === String(p.id))
      const totalMin = pSessions.reduce((acc, s) => acc + (s.durationMin || 0), 0)
      const unpaidMin = pSessions.reduce((acc, s) => acc + (s.isUnpaid ? (s.durationMin || 0) : 0), 0)
      const totalHours = totalMin / 60
      const revenue = p.revenue || p.quoteAmount || 0
      const effectiveHourly = totalHours > 0 ? Math.round(revenue / totalHours) : 0
      const unpaidRatio = totalMin > 0 ? unpaidMin / totalMin : 0
      const client = store.clients.find(c => String(c.id) === String(p.clientId))
      return {
        ...p,
        totalHours,
        effectiveHourly,
        unpaidRatio,
        clientName: client?.name || 'Client',
      }
    })
    .filter(p => p.totalHours > 0 || p.revenue > 0)
    .slice(0, 5)

  return matched
})

const medianEarnedRate = computed(() => {
  if (similarJobs.value.length === 0) return 0
  const rates = similarJobs.value.map(j => j.effectiveHourly).filter(r => r > 0).sort((a, b) => a - b)
  if (rates.length === 0) return 0
  const mid = Math.floor(rates.length / 2)
  return rates.length % 2 !== 0 ? rates[mid] : Math.round((rates[mid - 1] + rates[mid]) / 2)
})

const benchmarkInsightText = computed(() => {
  if (similarJobs.value.length === 0) return ''
  const med = medianEarnedRate.value
  const target = form.value.targetHourlyRate
  if (med >= target) {
    return `Great track record! Your effective hourly return in ${form.value.serviceCategory} exceeds your benchmark by ${Math.round(((med - target) / target) * 100)}%. The recommended target quote sustains this profitability.`
  }
  return `Warning: Historical projects in ${form.value.serviceCategory} averaged ${store.fmtCurrency(med)}/hr due to uncaptured scope or revisions. The ${form.value.unpaidBufferPercent}% unpaid buffer in this quote prevents repeat leakage.`
})

function getClientName(clientId) {
  const c = store.clients.find(item => String(item.id) === String(clientId))
  return c?.name || 'Independent'
}

function fmtCurrency(val) {
  return store.fmtCurrency(val)
}

function resetBufferToHistorical() {
  form.value.unpaidBufferPercent = historicalUnpaidRatio.value
}

function handleProjectSelect() {
  if (selectedProject.value) {
    form.value.estimatedHours = selectedProject.value.quoteEstHours || 40
    if (selectedProject.value.serviceCategory) {
      form.value.serviceCategory = selectedProject.value.serviceCategory
    }
  }
}

function recalculate() {
  // Reactive computed handles math automatically
}

function resetCalculator() {
  form.value.targetHourlyRate = store.user?.targetHourly || 100
  form.value.estimatedHours = 40
  form.value.unpaidBufferPercent = historicalUnpaidRatio.value
  form.value.expectedOverhead = 100
  form.value.directExpenses = 0
  form.value.targetMarginPercent = 20
  form.value.complexity = 'standard'
  selectedProjectId.value = ''
  toast.info('Calculator reset to profile defaults.')
}

function openApplyModal(type) {
  applyTargetProjectId.value = selectedProjectId.value || (activeProjects.value[0]?.id || '')
  applyQuoteAmount.value = type === 'min' ? calcResults.value.suggestedMinQuote : calcResults.value.suggestedTargetQuote
  applyEstHours.value = form.value.estimatedHours
  applyQuoteNotes.value = `Calculated via Wello Pricing Engine (${form.value.estimatedHours}h @ ${store.fmtCurrency(form.value.targetHourlyRate)}/h with ${form.value.unpaidBufferPercent}% unpaid buffer + ${form.value.targetMarginPercent}% margin).`
  showApplyModal.value = true
}

async function confirmApplyQuote() {
  if (!applyTargetProjectId.value) {
    toast.error('Please select a project to apply the quote to.')
    return
  }
  isApplying.value = true
  try {
    const res = await store.applyQuoteToProject({
      projectId: applyTargetProjectId.value,
      quoteAmount: applyQuoteAmount.value,
      estimatedHours: applyEstHours.value,
      quoteNotes: applyQuoteNotes.value,
    })
    if (res) {
      showApplyModal.value = false
      router.push(`/projects/${applyTargetProjectId.value}`)
    }
  } finally {
    isApplying.value = false
  }
}

onMounted(() => {
  form.value.unpaidBufferPercent = historicalUnpaidRatio.value
  if (route.query.projectId) {
    selectedProjectId.value = String(route.query.projectId)
    handleProjectSelect()
  }
})
</script>

<style scoped>
.quote-hero-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(168, 85, 247, 0.04) 100%);
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.min-quote-box {
  background: #FFFFFF;
  border-color: rgba(0, 0, 0, 0.08);
}

.target-quote-box {
  background: linear-gradient(180deg, rgba(238, 242, 255, 0.6) 0%, rgba(245, 243, 255, 0.6) 100%);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.08);
}

.border-purple-subtle {
  border-color: rgba(99, 102, 241, 0.15);
}

.text-purple-subtle {
  color: #6366F1;
}

.range-slider {
  accent-color: #6366F1;
  height: 6px;
  cursor: pointer;
}
</style>
