<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="modal-overlay" @click.self="$emit('close')" id="modal-expected-income-overlay">
        <div class="modal modal-lg" id="modal-expected-income" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title">Recurring & Expected Income</div>
              <div class="modal-subtitle">
                Confirm incoming salary, retainer, and recurring wage payments with one click
              </div>
            </div>
            <button class="modal-close" @click="$emit('close')" id="btn-close-expected-modal" aria-label="Close">
              <IconX />
            </button>
          </div>

          <div class="modal-body flex flex-col gap-4">
            <!-- Pending Proposals Banner -->
            <div v-if="pendingProposals.length > 0" class="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg text-xs text-purple-900 dark:text-purple-200 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-base">✨</span>
                <span>You have <strong>{{ pendingProposals.length }}</strong> recurring income item{{ pendingProposals.length > 1 ? 's' : '' }} ready to confirm for the current period.</span>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="store.expectedPayments.length === 0" class="p-8 text-center text-tertiary">
              <div class="text-3xl mb-2">📅</div>
              <div class="fw-600 text-sm text-primary mb-1">No expected payments pending</div>
              <div class="text-xs max-w-sm mx-auto">
                Configure your salaried jobs, retainers, or recurring wage income sources in Work Hub to automatically generate income confirmations each cycle.
              </div>
            </div>

            <!-- Proposals List -->
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="item in store.expectedPayments"
                :key="item.incomeSourceId + '-' + item.expectedPeriodStart"
                class="p-4 rounded-xl border transition-all"
                :class="item.isConfirmed ? 'bg-surface/50 border-neutral/60 opacity-80' : 'bg-surface border-primary/30 shadow-sm'"
                :id="`expected-row-${item.incomeSourceId}`"
              >
                <div class="flex items-start justify-between gap-4 flex-wrap">
                  <div class="flex items-start gap-3">
                    <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {{ getSourceIcon(item.sourceType) }}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="fw-700 text-sm text-primary">{{ item.sourceName }}</span>
                        <span class="badge badge-secondary text-2xs uppercase">{{ item.sourceType }}</span>
                        <span class="badge badge-purple text-2xs">{{ item.payFrequency }}</span>
                        <span v-if="item.isConfirmed" class="badge badge-success text-2xs">✓ Confirmed</span>
                        <span v-else class="badge badge-warning text-2xs">● Ready to Confirm</span>
                      </div>
                      <div class="text-xs text-tertiary mt-1">
                        Period: <strong>{{ item.expectedPeriodStart }}</strong>
                        <span v-if="item.expectedHours"> · Expected: {{ item.expectedHours }}h</span>
                      </div>
                    </div>
                  </div>

                  <div class="text-right">
                    <div class="fw-800 text-base text-primary">
                      {{ store.fmtCurrency(item.amount, item.currency) }}
                    </div>
                    <div class="text-[11px] text-tertiary">
                      {{ item.isConfirmed ? 'Recorded in balance' : 'Pending confirmation' }}
                    </div>
                  </div>
                </div>

                <!-- Confirmation / Adjustment Form (Visible if not confirmed or editing) -->
                <div v-if="!item.isConfirmed || editingItemId === item.incomeSourceId" class="mt-4 pt-3 border-t border-neutral/60 flex items-center justify-between flex-wrap gap-3">
                  <div class="flex items-center gap-3 flex-wrap text-xs">
                    <div class="flex items-center gap-1.5">
                      <span class="text-tertiary">Amount:</span>
                      <input
                        v-model.number="item._editAmount"
                        type="number"
                        step="any"
                        min="0"
                        class="form-input form-input-xs w-28 text-xs font-semibold"
                        placeholder="Amount"
                      />
                      <span class="text-tertiary font-bold">{{ item.currency }}</span>
                    </div>

                    <div class="flex items-center gap-1.5">
                      <span class="text-tertiary">Date Received:</span>
                      <input
                        v-model="item._editDate"
                        type="date"
                        class="form-input form-input-xs text-xs"
                      />
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      :disabled="item._isConfirming"
                      @click="handleConfirm(item)"
                      :id="`btn-confirm-expected-${item.incomeSourceId}`"
                    >
                      <span v-if="item._isConfirming">Saving...</span>
                      <span v-else>✓ Confirm Payment</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer flex items-center justify-between">
            <button class="btn btn-ghost text-xs" @click="$emit('close')">Close</button>
            <NuxtLink to="/work" class="btn btn-secondary btn-xs" @click="$emit('close')">
              Manage Income Sources →
            </NuxtLink>
          </div>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const emit = defineEmits(['close', 'confirmed'])
const store = useWelloStore()
const toast = useToast()

const editingItemId = ref(null)

const pendingProposals = computed(() => {
  return store.expectedPayments.filter(p => !p.isConfirmed)
})

function getSourceIcon(type) {
  switch (type) {
    case 'salary': return '💼'
    case 'hourly_wage': return '⏱️'
    case 'daily_wage': return '📅'
    case 'retainer': return '🔄'
    case 'gig': return '🛵'
    default: return '💰'
  }
}

onMounted(async () => {
  await store.fetchExpectedPayments()
  // Initialize editable fields
  store.expectedPayments.forEach(p => {
    if (p._editAmount == null) p._editAmount = Number(p.amount)
    if (!p._editDate) p._editDate = new Date().toISOString().slice(0, 10)
    p._isConfirming = false
  })
})

async function handleConfirm(item) {
  item._isConfirming = true
  try {
    await store.confirmExpectedPayment({
      incomeSourceId: item.incomeSourceId,
      amount: item._editAmount || item.amount,
      currency: item.currency,
      paymentDate: item._editDate || new Date().toISOString().slice(0, 10),
      expectedPeriodStart: item.expectedPeriodStart,
      notes: `Confirmed recurring ${item.sourceType} income for ${item.expectedPeriodStart}`,
    })
    toast.success(`Payment confirmed for "${item.sourceName}"!`)
    emit('confirmed')
  } catch (err) {
    console.error('Failed to confirm payment:', err)
    toast.error(err?.data?.message || err?.message || 'Failed to confirm expected payment.')
  } finally {
    item._isConfirming = false
  }
}
</script>
