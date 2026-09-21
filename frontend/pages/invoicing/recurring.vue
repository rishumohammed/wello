<template>
  <div class="recurring-invoices-page flex flex-col gap-6 animate-fade-in">
    <!-- Header -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div class="flex items-center gap-3">
        <NuxtLink to="/invoicing" class="btn btn-secondary btn-sm" id="btn-back-to-invoices">
          ← Back to Invoices
        </NuxtLink>
        <div>
          <h1 class="page-title">Recurring Retainer Profiles</h1>
          <p class="page-subtitle">Automate regular client retainer invoicing on weekly, monthly, quarterly, or annual schedules.</p>
        </div>
      </div>
      <div>
        <button class="btn btn-primary btn-sm" @click="openCreateModal" id="btn-create-recurring-profile">
          <IconPlus :size="14" /> New Recurring Profile
        </button>
      </div>
    </div>

    <!-- Toast Alert -->
    <div v-if="alertMessage" class="auth-alert mb-0" :class="alertType">
      <span>{{ alertMessage }}</span>
      <button class="btn btn-ghost btn-sm p-0 ml-auto" @click="alertMessage = ''">✕</button>
    </div>

    <!-- Profiles List -->
    <div class="card" id="recurring-profiles-card">
      <div v-if="isLoading" class="text-center py-12 text-tertiary text-sm">
        Loading recurring profiles…
      </div>

      <div v-else-if="profiles.length === 0" class="empty-state py-12">
        <div class="empty-icon"><IconReceipt :size="32" /></div>
        <div class="empty-title text-base mt-2">No recurring retainer profiles yet</div>
        <div class="empty-desc text-xs mt-1">Set up automated retainer billing schedules for your ongoing client engagements.</div>
        <button class="btn btn-primary btn-sm mt-3" @click="openCreateModal">Create First Profile</button>
      </div>

      <div v-else class="table-responsive">
        <table class="table" id="recurring-profiles-table">
          <thead>
            <tr>
              <th>Profile Title</th>
              <th>Client / Customer</th>
              <th>Frequency</th>
              <th>Next Run Date</th>
              <th class="table-text-right">Amount</th>
              <th>Auto-Send</th>
              <th>Status</th>
              <th class="table-text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in profiles" :key="p.id" :id="`recurring-row-${p.id}`">
              <td class="font-bold text-sm text-primary">
                {{ p.title }}
              </td>
              <td>
                <div class="text-xs font-semibold text-primary">{{ p.customerName }}</div>
                <div class="text-xs text-tertiary" v-if="p.customerContact">{{ p.customerContact }}</div>
              </td>
              <td>
                <span class="badge badge-purple text-xs uppercase">{{ p.frequency }}</span>
              </td>
              <td>
                <div class="text-xs font-semibold text-primary">{{ p.nextRunDate }}</div>
                <div class="text-xs text-tertiary">Every {{ p.frequency }}</div>
              </td>
              <td class="table-text-right font-extrabold text-sm text-primary">
                {{ fmtCurrency(p.amount, p.currency) }}
              </td>
              <td>
                <span class="badge" :class="p.autoSend ? 'badge-success' : 'badge-neutral'">
                  {{ p.autoSend ? 'Auto-Dispatched' : 'Save as Draft' }}
                </span>
              </td>
              <td>
                <span class="badge" :class="p.status === 'active' ? 'badge-success' : 'badge-warning'">
                  {{ p.status.toUpperCase() }}
                </span>
              </td>
              <td class="table-text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="btn btn-secondary btn-xs"
                    @click="toggleProfileStatus(p)"
                    :title="p.status === 'active' ? 'Pause Schedule' : 'Resume Schedule'"
                  >
                    {{ p.status === 'active' ? 'Pause' : 'Resume' }}
                  </button>
                  <button class="btn btn-primary btn-xs" @click="generateNow(p)" title="Generate Invoice Right Now">
                    Run Now
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Profile Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false" id="recurring-modal">
        <div class="modal modal-md max-w-540 w-full" role="dialog">
          <div class="modal-header">
            <div class="modal-title">New Recurring Retainer Profile</div>
            <button type="button" class="modal-close" @click="showModal = false"><IconX :size="16" /></button>
          </div>

          <form @submit.prevent="saveProfile" novalidate class="flex flex-col gap-3 p-4">
            <div class="form-group">
              <label class="form-label text-xs">Profile Title <span class="required">*</span></label>
              <input v-model="form.title" type="text" class="form-input text-xs" placeholder="e.g. Monthly Marketing Retainer" required />
            </div>

            <div class="grid-2 gap-3">
              <div class="form-group">
                <label class="form-label text-xs">Client Name <span class="required">*</span></label>
                <input v-model="form.customerName" type="text" class="form-input text-xs" placeholder="Client or Company Name" required />
              </div>
              <div class="form-group">
                <label class="form-label text-xs">Client Contact</label>
                <input v-model="form.customerContact" type="text" class="form-input text-xs" placeholder="billing@client.com" />
              </div>
            </div>

            <div class="grid-3 gap-3">
              <div class="form-group">
                <label class="form-label text-xs">Frequency</label>
                <select v-model="form.frequency" class="form-input text-xs">
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label text-xs">First Run Date <span class="required">*</span></label>
                <input v-model="form.nextRunDate" type="date" class="form-input text-xs" required />
              </div>
              <div class="form-group">
                <label class="form-label text-xs">Currency</label>
                <select v-model="form.currency" class="form-input text-xs">
                  <option v-for="c in ISO_CURRENCIES" :key="c.code" :value="c.code">{{ c.code }}</option>
                </select>
              </div>
            </div>

            <div class="grid-2 gap-3">
              <div class="form-group">
                <label class="form-label text-xs">Retainer Amount <span class="required">*</span></label>
                <input v-model.number="form.amount" type="number" step="any" min="1" class="form-input text-xs" placeholder="3000" required />
              </div>
              <div class="form-group">
                <label class="form-label text-xs">Payment Terms (Days)</label>
                <input v-model.number="form.paymentTermsDays" type="number" min="0" class="form-input text-xs" placeholder="15" />
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2">
              <input type="checkbox" v-model="form.autoSend" id="chk-autosend" />
              <label for="chk-autosend" class="text-xs cursor-pointer">
                Automatically email invoice to client upon generation (otherwise save as Draft)
              </label>
            </div>

            <div class="modal-footer mt-4">
              <button type="button" class="btn btn-secondary" @click="showModal = false">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="isSaving">Create Profile</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'
import { useFormatters } from '~/composables/useFormatters'
import { ISO_CURRENCIES } from '~/utils/currencyUtils'
import IconReceipt from '~/components/IconReceipt.vue'
import IconPlus from '~/components/IconPlus.vue'
import IconX from '~/components/IconX.vue'

const store = useWelloStore()
const authStore = useAuthStore()
const { fmtCurrency } = useFormatters()

const profiles = ref([])
const isLoading = ref(true)
const isSaving = ref(false)
const showModal = ref(false)
const alertMessage = ref('')
const alertType = ref('success')

const form = ref({
  title: '',
  customerName: '',
  customerContact: '',
  frequency: 'monthly',
  nextRunDate: new Date().toISOString().split('T')[0],
  currency: store.user.baseCurrency || 'USD',
  amount: 2500,
  paymentTermsDays: 14,
  autoSend: false,
})

async function fetchProfiles() {
  isLoading.value = true
  try {
    const res = await $fetch('/api/invoices/recurring', {
      params: { userId: authStore.user?.id || 'u1' }
    })
    if (res?.profiles) profiles.value = res.profiles
  } catch (err) {
    console.error('Failed to fetch recurring profiles:', err)
  } finally {
    isLoading.value = false
  }
}

function openCreateModal() {
  form.value = {
    title: '',
    customerName: '',
    customerContact: '',
    frequency: 'monthly',
    nextRunDate: new Date().toISOString().split('T')[0],
    currency: store.user.baseCurrency || 'USD',
    amount: 2500,
    paymentTermsDays: 14,
    autoSend: false,
  }
  showModal.value = true
}

async function saveProfile() {
  isSaving.value = true
  try {
    const res = await $fetch('/api/invoices/recurring', {
      method: 'POST',
      body: {
        ...form.value,
        userId: authStore.user?.id || 'u1',
      }
    })
    if (res?.success) {
      alertMessage.value = 'Recurring profile created successfully!'
      alertType.value = 'success'
      showModal.value = false
      await fetchProfiles()
    }
  } catch (err) {
    alertMessage.value = 'Failed to create profile.'
    alertType.value = 'error'
  } finally {
    isSaving.value = false
  }
}

async function toggleProfileStatus(profile) {
  const newStatus = profile.status === 'active' ? 'paused' : 'active'
  try {
    await $fetch('/api/invoices/recurring', {
      method: 'POST',
      body: {
        id: profile.id,
        userId: authStore.user?.id || 'u1',
        status: newStatus,
      }
    })
    profile.status = newStatus
    alertMessage.value = `Profile ${profile.title} is now ${newStatus}.`
    alertType.value = 'success'
  } catch (err) {
    alertMessage.value = 'Failed to update profile.'
    alertType.value = 'error'
  }
}

async function generateNow(profile) {
  try {
    const res = await $fetch('/api/invoices', {
      method: 'POST',
      body: {
        userId: authStore.user?.id || 'u1',
        customerName: profile.customerName,
        customerContact: profile.customerContact,
        serviceDescription: `Recurring Retainer: ${profile.title}`,
        currency: profile.currency,
        recurringProfileId: profile.id,
        items: [{
          description: `Retainer Billing - ${profile.title}`,
          quantity: 1,
          rate: profile.amount,
        }],
        status: profile.autoSend ? 'sent' : 'draft',
      }
    })
    if (res?.success) {
      alertMessage.value = `Invoice ${res.invoiceNumber} generated successfully!`
      alertType.value = 'success'
    }
  } catch (err) {
    alertMessage.value = 'Failed to generate invoice.'
    alertType.value = 'error'
  }
}

onMounted(() => {
  fetchProfiles()
})
</script>
