<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="modal-overlay" @click.self="$emit('close')" id="modal-expense-overlay">
        <div class="modal modal-sm" id="modal-expense" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title">Record Project Expense</div>
              <div class="modal-subtitle" v-if="selectedProject">{{ selectedProject.name }}</div>
            </div>
            <button class="modal-close" @click="$emit('close')" id="btn-close-expense-modal" aria-label="Close"><IconX /></button>
          </div>
          <form @submit.prevent="handleSubmit" novalidate>
            <div class="modal-body">
              <!-- Project selector if not preset -->
              <div class="form-group" v-if="!projectId">
                <label class="form-label" for="exp-project">Project <span class="required">*</span></label>
                <select id="exp-project" v-model="form.projectId" class="form-select" :class="{ error: errors.projectId }">
                  <option value="">Select project…</option>
                  <option v-for="p in availableProjects" :key="p.id" :value="p.id">
                    {{ p.name }} {{ p.isJob ? '(Job)' : '' }}
                  </option>
                </select>
                <span v-if="errors.projectId" class="form-error">{{ errors.projectId }}</span>
              </div>

              <div class="form-group">
                <label class="form-label" for="exp-desc">Expense Description <span class="required">*</span></label>
                <input
                  id="exp-desc"
                  v-model="form.description"
                  class="form-input"
                  :class="{ error: errors.description }"
                  type="text"
                  placeholder="e.g. Figma plugin license, Stock photos, Cloud hosting"
                  autocomplete="off"
                />
                <span v-if="errors.description" class="form-error">{{ errors.description }}</span>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="exp-amount">Amount ({{ store.currency }}) <span class="required">*</span></label>
                  <input
                    id="exp-amount"
                    v-model.number="form.amount"
                    class="form-input"
                    :class="{ error: errors.amount }"
                    type="number"
                    min="1"
                    step="10"
                    placeholder="e.g. 150"
                  />
                  <span v-if="errors.amount" class="form-error">{{ errors.amount }}</span>
                </div>
                <div class="form-group">
                  <label class="form-label" for="exp-date">Date Incurred</label>
                  <input id="exp-date" v-model="form.date" class="form-input" type="date" :max="todayStr" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="exp-category">Expense Category</label>
                <select id="exp-category" v-model="form.category" class="form-select">
                  <option value="software">Software & Subscriptions</option>
                  <option value="assets">Assets & Fonts / Media</option>
                  <option value="subcontractor">Subcontractor & Outsourcing</option>
                  <option value="travel">Travel & Transport</option>
                  <option value="hosting">Hosting & Infrastructure</option>
                  <option value="equipment">Equipment & Hardware</option>
                  <option value="other">Other Operational Expense</option>
                </select>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="$emit('close')" id="btn-cancel-expense">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-save-expense">Add Expense</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const props = defineProps({
  projectId: { type: String, default: '' },
})

const emit = defineEmits(['close', 'saved'])
const store = useWelloStore()
const toast = useToast()
const todayStr = new Date().toISOString().slice(0, 10)

const availableProjects = computed(() =>
  store.projects.filter(p => p.status !== 'lost')
)

const form = reactive({
  projectId: props.projectId || (availableProjects.value[0]?.id || ''),
  description: '',
  amount: null,
  date: todayStr,
  category: 'Assets',
})

const errors = reactive({ projectId: '', description: '', amount: '' })

const selectedProject = computed(() =>
  store.getProject(props.projectId || form.projectId)
)

function handleSubmit() {
  errors.projectId = ''
  errors.description = ''
  errors.amount = ''

  const targetProjId = props.projectId || form.projectId
  if (!targetProjId) {
    errors.projectId = 'Please select a project.'
    return
  }

  let ok = true
  if (!form.description.trim()) {
    errors.description = 'Description is required.'
    ok = false
  }
  if (!form.amount || form.amount <= 0) {
    errors.amount = 'Enter a valid expense amount.'
    ok = false
  }
  if (!ok) return

  store.addExpense(targetProjId, {
    description: form.description,
    amount: form.amount,
    date: form.date || todayStr,
    category: form.category,
  })

  toast.success(`Expense of ${store.fmtCurrency(form.amount)} recorded.`)
  emit('saved')
  emit('close')
}
</script>
