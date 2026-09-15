<template>
  <div class="admin-categories-page animate-fade-in">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="page-title">Job & Service Category Management</h1>
        <p class="page-subtitle">Manage platform service categories, create subcategories, reorder displays, and inspect category intelligence analytics.</p>
      </div>

      <div class="flex items-center gap-3">
        <button @click="showAddModal = true" class="btn btn-primary btn-sm" style="height:36px;">
          <IconPlus :size="14" class="mr-1" /> Add Category
        </button>
      </div>
    </div>

    <!-- Alert / Toast -->
    <div v-if="alertMessage" class="auth-alert mb-5" :class="alertType">
      <span>{{ alertMessage }}</span>
      <button class="btn btn-ghost btn-sm p-0 ml-auto" @click="alertMessage = ''">✕</button>
    </div>

    <!-- Categories Table Card -->
    <div class="card mb-6" id="categories-table-card">
      <div class="card-header flex items-center justify-between">
        <div>
          <div class="card-title">Active Platform Categories ({{ categories.length }})</div>
          <div class="card-subtitle">Categories powering job postings and work session classifications</div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Category Name</th>
              <th>Slug</th>
              <th>Description</th>
              <th>Type</th>
              <th>Status</th>
              <th class="table-text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in categories" :key="cat.id">
              <td>
                <div class="flex items-center gap-2">
                  <component :is="cat.icon || 'IconBriefcase'" :size="16" style="color:var(--color-purple);" />
                  <span class="fw-700 text-sm text-primary">{{ cat.name }}</span>
                </div>
              </td>
              <td class="text-xs font-mono text-secondary">{{ cat.slug }}</td>
              <td class="text-xs text-secondary max-w-sm truncate">{{ cat.description || '—' }}</td>
              <td>
                <span class="badge" :class="cat.parentId ? 'badge-quoted' : 'badge-completed'">
                  {{ cat.parentId ? 'Subcategory' : 'Main Category' }}
                </span>
              </td>
              <td>
                <button
                  @click="toggleStatus(cat)"
                  class="badge border-none cursor-pointer"
                  :class="cat.isActive ? 'badge-completed' : 'badge-lost'"
                >
                  {{ cat.isActive ? 'Active' : 'Disabled' }}
                </button>
              </td>
              <td class="table-text-right">
                <button @click="editCategory(cat)" class="btn btn-ghost btn-sm text-xs">Edit</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Category Intelligence View -->
    <div class="card card-padded">
      <div class="card-title mb-1">Category Intelligence & Growth Analytics</div>
      <div class="card-subtitle mb-4">Real demand metrics calculated from platform provider activity and connection rates</div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Category</th>
              <th class="table-text-right">Providers</th>
              <th class="table-text-right">Total Jobs</th>
              <th class="table-text-right">Completed</th>
              <th class="table-text-right">Connections</th>
              <th class="table-text-right">Growth Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in intelligence" :key="m.categoryId">
              <td class="fw-600 text-sm text-primary">{{ m.categoryName }}</td>
              <td class="table-text-right text-xs tabular fw-600">{{ m.providerCount }}</td>
              <td class="table-text-right text-xs tabular fw-600">{{ m.totalJobs }}</td>
              <td class="table-text-right text-xs tabular" style="color:var(--color-success);">{{ m.completedJobs }}</td>
              <td class="table-text-right text-xs tabular" style="color:var(--color-purple);">{{ m.successfulConnections }}</td>
              <td class="table-text-right text-xs tabular fw-700" style="color:var(--color-purple);">+{{ m.growthRatePercent }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Category Modal -->
    <div v-if="showAddModal" class="modal" role="dialog">
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title">{{ editId ? 'Edit Category' : 'Create New Category' }}</div>
          <button class="btn btn-ghost btn-sm" @click="closeModal">✕</button>
        </div>
        <form @submit.prevent="saveCategory">
          <div class="modal-body">
            <div class="form-group mb-3">
              <label class="form-label">Category Name</label>
              <input v-model="form.name" type="text" class="form-input" placeholder="e.g. AI Prompt Engineering" required />
            </div>
            <div class="form-group mb-3">
              <label class="form-label">Parent Category (Optional)</label>
              <select v-model="form.parentId" class="form-input">
                <option :value="null">None (Top-Level Main Category)</option>
                <option v-for="c in categories.filter(x => !x.parentId)" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="form-group mb-3">
              <label class="form-label">Description</label>
              <textarea v-model="form.description" class="form-input" rows="3" placeholder="Category scope and services overview…"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary">{{ editId ? 'Save Changes' : 'Create Category' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const categories = ref([])
const intelligence = ref([])
const alertMessage = ref('')
const alertType = ref('success')
const showAddModal = ref(false)
const editId = ref(null)

const form = ref({
  name: '',
  parentId: null,
  description: '',
})

onMounted(async () => {
  await fetchCategories()
  await fetchIntelligence()
})

async function fetchCategories() {
  try {
    const res = await $fetch('/api/categories')
    if (res?.categories) categories.value = res.categories
  } catch (err) {
    console.error(err)
  }
}

async function fetchIntelligence() {
  try {
    const res = await $fetch('/api/admin/categories/intelligence')
    if (res?.intelligence) intelligence.value = res.intelligence
  } catch (err) {
    console.error(err)
  }
}

async function saveCategory() {
  try {
    const payload = editId.value
      ? { action: 'UPDATE', id: editId.value, updates: { name: form.value.name, description: form.value.description } }
      : { action: 'CREATE', name: form.value.name, parentId: form.value.parentId, description: form.value.description }

    const res = await $fetch('/api/admin/categories', {
      method: 'POST',
      body: payload,
    })

    if (res?.success) {
      alertMessage.value = res.message
      alertType.value = 'success'
      closeModal()
      await fetchCategories()
    }
  } catch (err) {
    alertMessage.value = err?.data?.statusMessage || 'Failed to save category.'
    alertType.value = 'error'
  }
}

async function toggleStatus(cat) {
  try {
    const res = await $fetch('/api/admin/categories', {
      method: 'POST',
      body: { action: 'TOGGLE_STATUS', id: cat.id },
    })
    if (res?.success) {
      cat.isActive = res.category.isActive
      alertMessage.value = res.message
      alertType.value = 'success'
    }
  } catch (err) {
    console.error(err)
  }
}

function editCategory(cat) {
  editId.value = cat.id
  form.value.name = cat.name
  form.value.parentId = cat.parentId || null
  form.value.description = cat.description || ''
  showAddModal.value = true
}

function closeModal() {
  showAddModal.value = false
  editId.value = null
  form.value.name = ''
  form.value.parentId = null
  form.value.description = ''
}
</script>
