<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')" id="modal-project-form-overlay">
      <div class="modal" id="modal-project-form" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <div class="modal-title">{{ isEdit ? 'Edit Project' : 'New Project' }}</div>
            <div class="modal-subtitle">
              {{ isEdit ? 'Update project parameters and customer details.' : 'Start with a project. Record unpaid discovery or quote before conversion.' }}
            </div>
          </div>
          <button class="modal-close" @click="$emit('close')" id="btn-close-project-form" aria-label="Close">
            <IconX />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" novalidate>
          <div class="modal-body">
            <!-- Project name (Required) -->
            <div class="form-group">
              <label class="form-label" for="form-proj-name">
                Project Name <span class="required">*</span>
              </label>
              <input
                id="form-proj-name"
                v-model="form.name"
                class="form-input"
                :class="{ error: errors.name }"
                type="text"
                placeholder="e.g. ABC Website"
                maxlength="255"
                autocomplete="off"
              />
              <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
            </div>

            <!-- Customer / Client (Required) -->
            <div class="form-group">
              <div class="flex items-center justify-between mb-1">
                <label class="form-label mb-0" for="form-proj-client">
                  Customer <span class="required">*</span>
                </label>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  style="padding: 0 4px; height: auto; font-size: 11px; color: var(--color-purple);"
                  @click="showNewClient = !showNewClient"
                >
                  {{ showNewClient ? 'Choose existing' : '+ Add new customer' }}
                </button>
              </div>

              <!-- Quick create new client -->
              <div v-if="showNewClient" class="card card-padded mb-2" style="background: var(--color-off-white); border: 1px dashed var(--color-purple);">
                <div class="form-group mb-2">
                  <input
                    v-model="newClientName"
                    class="form-input"
                    type="text"
                    placeholder="Customer / Company name (e.g. ABC Corp)"
                  />
                </div>
                <div class="flex justify-end gap-2">
                  <button type="button" class="btn btn-secondary btn-sm" @click="showNewClient = false">Cancel</button>
                  <button type="button" class="btn btn-primary btn-sm" @click="quickCreateClient">Add Customer</button>
                </div>
              </div>

              <!-- Select existing client -->
              <select
                v-else
                id="form-proj-client"
                v-model="form.clientId"
                class="form-select"
                :class="{ error: errors.clientId }"
              >
                <option value="">Select customer…</option>
                <option v-for="c in store.clients" :key="c.id" :value="c.id">
                  {{ c.name }} {{ c.company ? `(${c.company})` : '' }}
                </option>
              </select>
              <span v-if="errors.clientId" class="form-error">{{ errors.clientId }}</span>
            </div>

            <!-- Service Category & Status -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="form-proj-service">Service / Category</label>
                <select id="form-proj-service" v-model="form.serviceCategory" class="form-select">
                  <option value="Web Development">Web Development</option>
                  <option value="Design & Development">Design & Development</option>
                  <option value="UI/UX Design">UI/UX Design</option>
                  <option value="Consulting & Strategy">Consulting & Strategy</option>
                  <option value="Software Engineering">Software Engineering</option>
                  <option value="Branding">Branding</option>
                  <option value="Content & Copywriting">Content & Copywriting</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="form-proj-status">Status</label>
                <select id="form-proj-status" v-model="form.status" class="form-select">
                  <option value="potential">Potential (Default)</option>
                  <option value="quoted">Quoted</option>
                  <option value="approved">Approved</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
            </div>

            <!-- Description -->
            <div class="form-group">
              <label class="form-label" for="form-proj-desc">Description</label>
              <textarea
                id="form-proj-desc"
                v-model="form.description"
                class="form-textarea"
                placeholder="Scope, objectives, customer requirements…"
                rows="2"
              ></textarea>
            </div>

            <!-- Optional Estimation / Target Value -->
            <div class="form-divider"><span>Optional estimation & target value</span></div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="form-proj-quote">Quote / Budget ({{ store.currency }})</label>
                <input
                  id="form-proj-quote"
                  v-model.number="form.quoteAmount"
                  class="form-input"
                  type="number"
                  min="0"
                  placeholder="e.g. 25000"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="form-proj-hours">Estimated Hours</label>
                <input
                  id="form-proj-hours"
                  v-model.number="form.quoteEstHours"
                  class="form-input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 35"
                />
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="$emit('close')" id="btn-cancel-project-form">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving" id="btn-save-project-form">
              <span v-if="saving">Saving…</span>
              <span v-else>{{ isEdit ? 'Save Changes' : 'Create Project' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const props = defineProps({
  project: { type: Object, default: null },
})

const emit = defineEmits(['close', 'created', 'updated'])
const store = useWelloStore()
const toast = useToast()
const saving = ref(false)

const isEdit = computed(() => !!props.project)

const showNewClient = ref(false)
const newClientName = ref('')

const form = reactive({
  name: props.project?.name || '',
  clientId: props.project?.clientId || (store.clients[0]?.id || ''),
  serviceCategory: props.project?.serviceCategory || 'Web Development',
  description: props.project?.description || '',
  status: props.project?.status || 'potential',
  quoteAmount: props.project?.quoteAmount || null,
  quoteEstHours: props.project?.quoteEstHours || null,
})

const errors = reactive({ name: '', clientId: '' })

function quickCreateClient() {
  if (!newClientName.value.trim()) return
  const client = store.createClient({ name: newClientName.value.trim() })
  form.clientId = client.id
  showNewClient.value = false
  newClientName.value = ''
  toast.success(`Customer "${client.name}" added.`)
}

function validate() {
  errors.name = ''
  errors.clientId = ''
  let ok = true

  if (!form.name.trim()) {
    errors.name = 'Project name is required.'
    ok = false
  }
  if (!form.clientId) {
    errors.clientId = 'Customer selection is required.'
    ok = false
  }

  return ok
}

async function handleSubmit() {
  if (!validate()) return
  saving.value = true

  try {
    if (isEdit.value) {
      store.updateProject(props.project.id, {
        name: form.name.trim(),
        clientId: form.clientId,
        serviceCategory: form.serviceCategory,
        description: form.description.trim(),
        status: form.status,
        quoteAmount: form.quoteAmount ? Number(form.quoteAmount) : null,
        quoteEstHours: form.quoteEstHours ? Number(form.quoteEstHours) : null,
      })
      toast.success('Project updated.')
      emit('updated', props.project.id)
    } else {
      const newProj = store.createProject({
        name: form.name.trim(),
        clientId: form.clientId,
        serviceCategory: form.serviceCategory,
        description: form.description.trim(),
        quoteAmount: form.quoteAmount ? Number(form.quoteAmount) : null,
        quoteEstHours: form.quoteEstHours ? Number(form.quoteEstHours) : null,
      })

      // If initial status was customized beyond potential
      if (form.status && form.status !== 'potential') {
        store.updateProject(newProj.id, { status: form.status })
      }

      toast.success(`Project "${newProj.name}" created.`)
      emit('created', newProj)
    }
    emit('close')
  } finally {
    saving.value = false
  }
}
</script>
