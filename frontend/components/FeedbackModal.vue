<template>
  <ClientOnly>
    <Teleport to="body">
      <div v-if="isOpen" class="modal-overlay" @click.self="close" id="modal-feedback-overlay">
        <div class="modal modal-md" id="modal-feedback" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title flex items-center gap-2">
                <span>💬</span>
                <span>Send Feedback & Support</span>
              </div>
              <div class="modal-subtitle">
                Have a question, idea, or found a bug? We read every submission.
              </div>
            </div>
            <button class="modal-close" @click="close" id="btn-close-feedback-modal" aria-label="Close">
              <IconX :size="16" />
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="modal-body flex flex-col gap-4">
            <!-- Category Radio Grid -->
            <div class="form-group">
              <label class="form-label">Category</label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  v-for="cat in categories"
                  :key="cat.id"
                  class="p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all text-left"
                  :class="form.category === cat.id ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'border-neutral bg-surface text-secondary hover:border-secondary'"
                  @click="form.category = cat.id"
                  :id="`btn-feedback-cat-${cat.id}`"
                >
                  <span>{{ cat.icon }}</span>
                  <span>{{ cat.label }}</span>
                </button>
              </div>
            </div>

            <!-- Subject -->
            <div class="form-group">
              <label class="form-label" for="input-feedback-subject">Subject (Optional)</label>
              <input
                id="input-feedback-subject"
                v-model="form.subject"
                type="text"
                class="form-input text-xs rounded-lg"
                placeholder="Brief summary of your message..."
              />
            </div>

            <!-- Message -->
            <div class="form-group">
              <label class="form-label" for="textarea-feedback-message">
                Message <span class="required">*</span>
              </label>
              <textarea
                id="textarea-feedback-message"
                v-model="form.message"
                class="form-input text-xs rounded-lg h-28 resize-none"
                placeholder="Describe your issue, feature suggestion, or question in detail..."
                required
              ></textarea>
            </div>

            <div class="modal-footer flex items-center justify-between pt-2">
              <button type="button" class="btn btn-ghost text-xs" @click="close">
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary btn-sm font-bold"
                :disabled="isSubmitting || !form.message.trim()"
                id="btn-submit-feedback"
              >
                <span>{{ isSubmitting ? 'Sending...' : 'Submit Message' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'
import IconX from '~/components/IconX.vue'

const store = useWelloStore()
const toast = useToast()

const isOpen = computed(() => store.showFeedbackModal)
const isSubmitting = ref(false)

const form = ref({
  category: 'feature',
  subject: '',
  message: '',
})

const categories = [
  { id: 'feature', label: 'Feature Idea', icon: '💡' },
  { id: 'bug', label: 'Bug Report', icon: '🐛' },
  { id: 'question', label: 'Question', icon: '❓' },
  { id: 'support', label: 'Help / Support', icon: '🛟' },
  { id: 'general', label: 'General', icon: '💬' },
]

function close() {
  store.showFeedbackModal = false
  form.value = { category: 'feature', subject: '', message: '' }
}

async function handleSubmit() {
  if (!form.value.message.trim()) return
  isSubmitting.value = true
  try {
    await store.submitFeedback(form.value)
    toast.success('Thank you! Your feedback has been received.')
    close()
  } catch (err) {
    toast.error(err?.data?.message || err?.message || 'Failed to submit feedback.')
  } finally {
    isSubmitting.value = false
  }
}
</script>
