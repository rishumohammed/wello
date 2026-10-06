<template>
  <ClientOnly>
    <Teleport to="body">
      <div v-if="isOpen" class="modal-overlay" id="modal-onboarding-overlay">
        <div class="modal modal-lg onboarding-modal animate-fade-in" id="modal-onboarding-wizard" role="dialog" aria-modal="true">
          <!-- Wizard Progress Bar Header -->
          <div class="onboarding-header">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="onboarding-logo-box">
                  <span>W</span>
                </div>
                <div>
                  <div class="onboarding-title">Welcome to Wello</div>
                  <div class="onboarding-step-subtitle">Step {{ currentStep }} of 4 &bull; {{ stepTitles[currentStep - 1] }}</div>
                </div>
              </div>

              <button
                v-if="currentStep > 1"
                class="btn btn-ghost btn-xs text-tertiary"
                @click="skipOnboarding"
                id="btn-skip-onboarding"
              >
                Skip to Dashboard
              </button>
            </div>

            <!-- Stepper Progress Bar -->
            <div class="stepper-track">
              <div
                v-for="s in 4"
                :key="s"
                class="stepper-segment"
                :class="{ active: s <= currentStep }"
              ></div>
            </div>
          </div>

          <!-- Wizard Body -->
          <div class="onboarding-body">
            <!-- ───────────────────────────────────────────────────────────── -->
            <!-- STEP 1: REGION, TIMEZONE & CURRENCY                           -->
            <!-- ───────────────────────────────────────────────────────────── -->
            <div v-if="currentStep === 1" class="step-pane animate-fade-in">
              <div class="step-intro">
                <h2 class="step-heading">Set your regional baseline</h2>
                <p class="step-desc">
                  Wello computes your hourly return, today boundaries, and reports using your local timezone and currency.
                </p>
              </div>

              <div class="grid-2 gap-4 pt-2">
                <div class="form-group">
                  <label class="form-label" for="onboard-currency">Base Currency</label>
                  <select id="onboard-currency" v-model="form.baseCurrency" class="form-select">
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="CAD">CAD ($) - Canadian Dollar</option>
                    <option value="AUD">AUD ($) - Australian Dollar</option>
                    <option value="JPY">JPY (¥) - Japanese Yen</option>
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="SGD">SGD ($) - Singapore Dollar</option>
                    <option value="CHF">CHF (Fr) - Swiss Franc</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="onboard-country">Country</label>
                  <input
                    id="onboard-country"
                    v-model="form.country"
                    type="text"
                    class="form-input"
                    placeholder="e.g. United States, Germany, United Kingdom"
                  />
                </div>
              </div>

              <div class="form-group mt-3">
                <div class="flex items-center justify-between mb-1">
                  <label class="form-label mb-0" for="onboard-timezone">Timezone (IANA)</label>
                  <button type="button" class="btn btn-ghost btn-xs text-primary font-semibold" @click="detectTz">
                    Auto-detect ({{ form.timezone }})
                  </button>
                </div>
                <input
                  id="onboard-timezone"
                  v-model="form.timezone"
                  type="text"
                  class="form-input font-mono text-xs"
                  placeholder="e.g. America/New_York, Europe/London"
                />
              </div>
            </div>

            <!-- ───────────────────────────────────────────────────────────── -->
            <!-- STEP 2: HOW DO YOU EARN? (PERSONA)                            -->
            <!-- ───────────────────────────────────────────────────────────── -->
            <div v-else-if="currentStep === 2" class="step-pane animate-fade-in">
              <div class="step-intro">
                <h2 class="step-heading">How do you earn?</h2>
                <p class="step-desc">
                  Select your primary earning model. Wello will automatically configure your workflow and rate analytics.
                </p>
              </div>

              <div class="grid-2 gap-3 pt-2">
                <div
                  v-for="p in personas"
                  :key="p.key"
                  class="persona-card"
                  :class="{ selected: form.earningPersona === p.key }"
                  @click="form.earningPersona = p.key"
                  :id="`btn-onboard-persona-${p.key}`"
                >
                  <div>
                    <div class="persona-icon">{{ p.icon }}</div>
                    <div class="persona-title">{{ p.title }}</div>
                    <div class="persona-desc">{{ p.description }}</div>
                  </div>
                  <div class="persona-footer">
                    <span>Includes: {{ p.addons }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- ───────────────────────────────────────────────────────────── -->
            <!-- STEP 3: INCOME TARGET & RATE GOAL                             -->
            <!-- ───────────────────────────────────────────────────────────── -->
            <div v-else-if="currentStep === 3" class="step-pane animate-fade-in">
              <div class="step-intro">
                <h2 class="step-heading">Set your financial targets</h2>
                <p class="step-desc">
                  Define your target hourly benchmark and monthly revenue goals to unlock real-time rate pacing.
                </p>
              </div>

              <div class="grid-2 gap-4 pt-2">
                <div class="form-group">
                  <label class="form-label" for="onboard-target-hourly">
                    Target Hourly Rate ({{ form.baseCurrency }}/hr)
                  </label>
                  <input
                    id="onboard-target-hourly"
                    v-model.number="form.targetHourly"
                    type="number"
                    step="1"
                    min="0"
                    class="form-input font-bold"
                    placeholder="75"
                  />
                  <span class="form-hint">Used to evaluate project profitability and unpaid time cost.</span>
                </div>

                <div class="form-group">
                  <label class="form-label" for="onboard-target-monthly">
                    Monthly Revenue Target ({{ form.baseCurrency }}/mo)
                  </label>
                  <input
                    id="onboard-target-monthly"
                    v-model.number="form.targetMonthlyIncome"
                    type="number"
                    step="100"
                    min="0"
                    class="form-input font-bold"
                    placeholder="6000"
                  />
                  <span class="form-hint">Your monthly revenue benchmark for pace tracking.</span>
                </div>
              </div>
            </div>

            <!-- ───────────────────────────────────────────────────────────── -->
            <!-- STEP 4: FIRST ACTION (OPTIONAL)                               -->
            <!-- ───────────────────────────────────────────────────────────── -->
            <div v-else-if="currentStep === 4" class="step-pane animate-fade-in">
              <div class="step-intro">
                <h2 class="step-heading">You're all set! Ready for your first entry?</h2>
                <p class="step-desc">
                  Choose a quick starting action or go directly to your customized workspace.
                </p>
              </div>

              <div class="grid-3 gap-3 pt-2">
                <button
                  type="button"
                  class="action-card"
                  @click="finishWithAction('timer')"
                  id="btn-onboard-action-timer"
                >
                  <div>
                    <div class="action-card-icon">⏱️</div>
                    <div class="action-card-title">Start Live Timer</div>
                    <div class="action-card-desc">Track billable or discovery work right now.</div>
                  </div>
                  <span class="action-card-link">Launch Timer &rarr;</span>
                </button>

                <button
                  type="button"
                  class="action-card"
                  @click="finishWithAction('project')"
                  id="btn-onboard-action-project"
                >
                  <div>
                    <div class="action-card-icon">📁</div>
                    <div class="action-card-title">Add First Project</div>
                    <div class="action-card-desc">Create your first client account and proposal.</div>
                  </div>
                  <span class="action-card-link">Add Project &rarr;</span>
                </button>

                <button
                  type="button"
                  class="action-card"
                  @click="finishWithAction('dashboard')"
                  id="btn-onboard-action-dashboard"
                >
                  <div>
                    <div class="action-card-icon">📊</div>
                    <div class="action-card-title">Explore Dashboard</div>
                    <div class="action-card-desc">View your rate metrics, reports, and settings.</div>
                  </div>
                  <span class="action-card-link">Go to Dashboard &rarr;</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Wizard Footer Controls -->
          <div class="onboarding-footer">
            <button
              v-if="currentStep > 1"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="currentStep--"
            >
              &larr; Back
            </button>
            <div v-else></div>

            <button
              v-if="currentStep < 4"
              type="button"
              class="btn btn-primary btn-sm"
              @click="nextStep"
              :id="`btn-onboard-next-${currentStep}`"
            >
              Continue &rarr;
            </button>
            <button
              v-else
              type="button"
              class="btn btn-primary btn-sm"
              @click="finishWithAction('dashboard')"
              :disabled="isSaving"
              id="btn-onboard-complete"
            >
              {{ isSaving ? 'Finalizing...' : 'Finish Setup ✨' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const router = useRouter()
const store = useWelloStore()
const toast = useToast()

const isOpen = computed(() => store.showOnboardingWizard)
const currentStep = ref(1)
const isSaving = ref(false)

const stepTitles = [
  'Regional Baseline',
  'Earning Model',
  'Target Rates',
  'Ready to Begin',
]

const form = ref({
  baseCurrency: store.user?.baseCurrency || 'USD',
  country: store.user?.country || '',
  timezone: store.user?.timezone || 'UTC',
  earningPersona: store.user?.earningPersona || 'freelancer_projects',
  targetHourly: store.user?.targetHourly || 75,
  targetMonthlyIncome: store.user?.targetMonthlyIncome || 6000,
})

const personas = [
  {
    key: 'freelancer_projects',
    icon: '💼',
    title: 'Freelancer / Projects',
    description: 'Fixed-price and milestone projects for multiple clients.',
    addons: 'Invoicing, Quotes, Rates',
  },
  {
    key: 'salaried',
    icon: '🏢',
    title: 'Salaried Employee',
    description: 'Fixed salary; tracking commute drag and overtime.',
    addons: 'Reports, Overheads',
  },
  {
    key: 'daily_hourly_wage',
    icon: '⏱️',
    title: 'Daily & Hourly Shifts',
    description: 'Hourly contractor or tradesperson across shifts.',
    addons: 'Quick Entry, Timer',
  },
  {
    key: 'gig_retainer',
    icon: '⚡',
    title: 'Gig & Retainers',
    description: 'Recurring retainers and dynamic platform tasks.',
    addons: 'Retainers, Reports',
  },
]

function detectTz() {
  try {
    form.value.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {}
}

function nextStep() {
  if (currentStep.value < 4) {
    currentStep.value++
  }
}

async function skipOnboarding() {
  await finishWithAction('dashboard')
}

async function finishWithAction(action) {
  isSaving.value = true
  try {
    await store.completeOnboarding({
      ...form.value,
      onboardingCompleted: true,
    })
    toast.success('Workspace customized successfully!')
    store.showOnboardingWizard = false

    if (action === 'timer') {
      store.showTimerModal = true
    } else if (action === 'project') {
      router.push('/work')
    } else {
      router.push('/work')
    }
  } catch (err) {
    toast.error(err?.data?.message || err?.message || 'Failed to complete setup.')
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  detectTz()
})
</script>

<style scoped>
.onboarding-modal {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-2xl);
  overflow: hidden;
  box-shadow: var(--shadow-xl);
}

.onboarding-header {
  padding: 20px 24px 16px;
  background: var(--color-off-white);
  border-bottom: 1px solid var(--border-color);
}

.onboarding-logo-box {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  background: var(--grad-brand);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 15px;
  box-shadow: 0 2px 8px rgba(122, 63, 246, 0.25);
}

.onboarding-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.2px;
}

.onboarding-step-subtitle {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 1px;
}

.stepper-track {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stepper-segment {
  height: 5px;
  flex: 1;
  border-radius: var(--radius-full);
  background: var(--color-soft-gray);
  transition: all var(--transition-apple-ease);
}

.stepper-segment.active {
  background: var(--grad-brand);
}

.onboarding-body {
  padding: 24px;
  max-height: 70vh;
  overflow-y: auto;
}

.step-intro {
  margin-bottom: 16px;
}

.step-heading {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.step-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.persona-card {
  background: var(--color-off-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  transition: all var(--transition-apple-ease);
}

.persona-card:hover {
  background: var(--color-white);
  border-color: rgba(122, 63, 246, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.05);
}

.persona-card.selected {
  background: rgba(122, 63, 246, 0.05);
  border-color: var(--color-purple);
  box-shadow: 0 0 0 2px rgba(122, 63, 246, 0.2);
}

.persona-icon {
  font-size: 22px;
  margin-bottom: 6px;
}

.persona-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.persona-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.persona-footer {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-purple);
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding-top: 8px;
}

.action-card {
  background: var(--color-off-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  transition: all var(--transition-apple-ease);
}

.action-card:hover {
  background: var(--color-white);
  border-color: var(--color-purple);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.05);
}

.action-card-icon {
  font-size: 22px;
  margin-bottom: 6px;
}

.action-card-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.action-card-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.action-card-link {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-purple);
}

.onboarding-footer {
  padding: 16px 24px;
  background: var(--color-off-white);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
