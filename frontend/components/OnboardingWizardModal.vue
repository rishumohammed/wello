<template>
  <ClientOnly>
    <Teleport to="body">
      <div v-if="isOpen" class="modal-overlay" id="modal-onboarding-overlay">
        <div class="modal modal-lg rounded-2xl shadow-2xl border border-neutral/60 overflow-hidden" id="modal-onboarding-wizard" role="dialog" aria-modal="true">
          <!-- Wizard Progress Bar Header -->
          <div class="bg-surface p-6 pb-4 border-b border-neutral/60">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                  W
                </div>
                <div>
                  <div class="font-extrabold text-sm text-primary">Welcome to Wello</div>
                  <div class="text-2xs text-tertiary">Step {{ currentStep }} of 4 &bull; {{ stepTitles[currentStep - 1] }}</div>
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

            <!-- Stepper Progress Dots -->
            <div class="flex items-center gap-2">
              <div
                v-for="s in 4"
                :key="s"
                class="h-1.5 flex-1 rounded-full transition-all"
                :class="s <= currentStep ? 'bg-primary' : 'bg-neutral/40'"
              ></div>
            </div>
          </div>

          <!-- Wizard Body -->
          <div class="p-6 bg-surface max-h-[70vh] overflow-y-auto">
            <!-- ───────────────────────────────────────────────────────────── -->
            <!-- STEP 1: REGION, TIMEZONE & CURRENCY                           -->
            <!-- ───────────────────────────────────────────────────────────── -->
            <div v-if="currentStep === 1" class="space-y-4 animate-fade-in">
              <div>
                <h2 class="text-base font-bold text-primary mb-1">Set your regional baseline</h2>
                <p class="text-xs text-tertiary">
                  Wello computes your hourly return, today boundaries, and reports using your local timezone and currency.
                </p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div class="form-group">
                  <label class="form-label" for="onboard-currency">Base Currency</label>
                  <select id="onboard-currency" v-model="form.baseCurrency" class="form-select text-xs">
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
                    class="form-input text-xs"
                    placeholder="e.g. United States, Germany, United Kingdom"
                  />
                </div>
              </div>

              <div class="form-group">
                <div class="flex items-center justify-between mb-1">
                  <label class="form-label mb-0" for="onboard-timezone">Timezone (IANA)</label>
                  <button type="button" class="text-2xs text-primary font-semibold hover:underline" @click="detectTz">
                    Auto-detect
                  </button>
                </div>
                <input
                  id="onboard-timezone"
                  v-model="form.timezone"
                  type="text"
                  class="form-input text-xs font-mono"
                  placeholder="e.g. America/New_York, Europe/London"
                />
              </div>
            </div>

            <!-- ───────────────────────────────────────────────────────────── -->
            <!-- STEP 2: HOW DO YOU EARN? (PERSONA)                            -->
            <!-- ───────────────────────────────────────────────────────────── -->
            <div v-else-if="currentStep === 2" class="space-y-4 animate-fade-in">
              <div>
                <h2 class="text-base font-bold text-primary mb-1">How do you earn?</h2>
                <p class="text-xs text-tertiary">
                  Select your primary earning model. Wello will automatically activate your free store addons tailored to your workflow.
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div
                  v-for="p in personas"
                  :key="p.key"
                  class="p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between"
                  :class="form.earningPersona === p.key ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary' : 'border-neutral bg-surface hover:border-secondary'"
                  @click="form.earningPersona = p.key"
                  :id="`btn-onboard-persona-${p.key}`"
                >
                  <div>
                    <div class="text-2xl mb-1.5">{{ p.icon }}</div>
                    <div class="font-bold text-xs text-primary mb-1">{{ p.title }}</div>
                    <div class="text-2xs text-tertiary leading-relaxed">{{ p.description }}</div>
                  </div>
                  <div class="mt-3 pt-2 border-t border-neutral/40 text-[10px] text-primary font-semibold">
                    Includes: {{ p.addons }}
                  </div>
                </div>
              </div>
            </div>

            <!-- ───────────────────────────────────────────────────────────── -->
            <!-- STEP 3: INCOME TARGET & RATE GOAL                             -->
            <!-- ───────────────────────────────────────────────────────────── -->
            <div v-else-if="currentStep === 3" class="space-y-4 animate-fade-in">
              <div>
                <h2 class="text-base font-bold text-primary mb-1">Set your financial targets</h2>
                <p class="text-xs text-tertiary">
                  Define your target hourly return and monthly revenue goals to unlock real-time pacing metrics.
                </p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div class="form-group">
                  <label class="form-label" for="onboard-target-hourly">
                    Target Hourly Rate ({{ form.baseCurrency }}/hr)
                  </label>
                  <div class="relative">
                    <input
                      id="onboard-target-hourly"
                      v-model.number="form.targetHourly"
                      type="number"
                      step="1"
                      min="0"
                      class="form-input text-xs pl-7 font-bold"
                      placeholder="75"
                    />
                    <span class="absolute left-2.5 top-2.5 text-xs text-tertiary font-bold">$</span>
                  </div>
                  <span class="form-hint text-2xs mt-1">Used to evaluate proposal profitability and unpaid time cost.</span>
                </div>

                <div class="form-group">
                  <label class="form-label" for="onboard-target-monthly">
                    Monthly Revenue Target ({{ form.baseCurrency }}/mo)
                  </label>
                  <div class="relative">
                    <input
                      id="onboard-target-monthly"
                      v-model.number="form.targetMonthlyIncome"
                      type="number"
                      step="100"
                      min="0"
                      class="form-input text-xs pl-7 font-bold"
                      placeholder="6000"
                    />
                    <span class="absolute left-2.5 top-2.5 text-xs text-tertiary font-bold">$</span>
                  </div>
                  <span class="form-hint text-2xs mt-1">Your monthly revenue benchmark for pace tracking.</span>
                </div>
              </div>
            </div>

            <!-- ───────────────────────────────────────────────────────────── -->
            <!-- STEP 4: FIRST ACTION (OPTIONAL)                               -->
            <!-- ───────────────────────────────────────────────────────────── -->
            <div v-else-if="currentStep === 4" class="space-y-4 animate-fade-in">
              <div>
                <h2 class="text-base font-bold text-primary mb-1">You're all set! Ready for your first entry?</h2>
                <p class="text-xs text-tertiary">
                  Choose a quick starting action or go directly to your customized workspace.
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  class="p-4 rounded-xl border border-neutral hover:border-primary bg-surface text-left transition-all group flex flex-col justify-between"
                  @click="finishWithAction('timer')"
                  id="btn-onboard-action-timer"
                >
                  <div>
                    <div class="text-2xl mb-1.5">⏱️</div>
                    <div class="font-bold text-xs text-primary group-hover:text-primary">Start Live Timer</div>
                    <div class="text-2xs text-tertiary mt-1">Track billable or discovery work right now.</div>
                  </div>
                  <span class="text-xs text-primary font-bold mt-3">&rarr; Launch Timer</span>
                </button>

                <button
                  type="button"
                  class="p-4 rounded-xl border border-neutral hover:border-primary bg-surface text-left transition-all group flex flex-col justify-between"
                  @click="finishWithAction('project')"
                  id="btn-onboard-action-project"
                >
                  <div>
                    <div class="text-2xl mb-1.5">📁</div>
                    <div class="font-bold text-xs text-primary group-hover:text-primary">Add First Client/Project</div>
                    <div class="text-2xs text-tertiary mt-1">Create your first client account and proposal.</div>
                  </div>
                  <span class="text-xs text-primary font-bold mt-3">&rarr; Add Project</span>
                </button>

                <button
                  type="button"
                  class="p-4 rounded-xl border border-neutral hover:border-primary bg-surface text-left transition-all group flex flex-col justify-between"
                  @click="finishWithAction('dashboard')"
                  id="btn-onboard-action-dashboard"
                >
                  <div>
                    <div class="text-2xl mb-1.5">📊</div>
                    <div class="font-bold text-xs text-primary group-hover:text-primary">Explore Workspace</div>
                    <div class="text-2xs text-tertiary mt-1">View your dashboard, reports, and free store addons.</div>
                  </div>
                  <span class="text-xs text-primary font-bold mt-3">&rarr; Go to Dashboard</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Wizard Footer Controls -->
          <div class="p-6 pt-4 bg-surface border-t border-neutral/60 flex items-center justify-between">
            <button
              v-if="currentStep > 1"
              type="button"
              class="btn btn-ghost btn-sm text-xs"
              @click="currentStep--"
            >
              &larr; Back
            </button>
            <div v-else></div>

            <button
              v-if="currentStep < 4"
              type="button"
              class="btn btn-primary btn-sm font-bold text-xs"
              @click="nextStep"
              :id="`btn-onboard-next-${currentStep}`"
            >
              Continue &rarr;
            </button>
            <button
              v-else
              type="button"
              class="btn btn-primary btn-sm font-bold text-xs"
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
