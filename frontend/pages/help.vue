<template>
  <div class="help-page max-w-5xl mx-auto py-8 px-4 animate-fade-in flex flex-col gap-8">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral/60">
      <div>
        <h1 class="text-3xl font-extrabold text-primary tracking-tight">Help & Knowledge Base</h1>
        <p class="text-xs text-tertiary mt-1.5">
          Everything you need to master your time tracking, client invoicing, and true hourly returns.
        </p>
      </div>

      <button
        class="btn btn-primary btn-sm flex items-center gap-1.5 self-start md:self-auto font-bold"
        @click="openFeedbackModal"
        id="btn-help-contact-support"
      >
        <span>💬</span>
        <span>Send Feedback or Ask a Question</span>
      </button>
    </div>

    <!-- Search & Category Filters -->
    <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">
      <div class="relative w-full sm:w-80">
        <input
          v-model="searchQuery"
          type="text"
          class="form-input text-xs pl-8 pr-3 py-2 w-full rounded-xl"
          placeholder="Search topics (e.g. invoice, offline, tax, rate)..."
          id="input-help-search"
        />
        <span class="absolute left-2.5 top-2.5 text-xs text-tertiary">🔍</span>
      </div>

      <div class="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
        <button
          v-for="c in categories"
          :key="c.id"
          class="filter-chip text-xs"
          :class="{ active: selectedCategory === c.id }"
          @click="selectedCategory = c.id"
        >
          <span>{{ c.icon }}</span>
          <span>{{ c.label }}</span>
        </button>
      </div>
    </div>

    <!-- FAQ Accordion Grid -->
    <div class="space-y-4">
      <div
        v-for="(faq, idx) in filteredFaqs"
        :key="idx"
        class="card border-neutral/60 bg-surface overflow-hidden transition-all"
      >
        <button
          class="w-full text-left p-4.5 flex items-center justify-between gap-4 font-bold text-sm text-primary hover:bg-neutral/20 transition-colors"
          @click="toggleFaq(idx)"
          :id="`btn-faq-toggle-${idx}`"
        >
          <span class="flex items-center gap-2.5">
            <span class="text-base">{{ faq.icon }}</span>
            <span>{{ faq.question }}</span>
          </span>
          <span class="text-xs text-tertiary font-mono">{{ openFaqs.includes(idx) ? '▲' : '▼' }}</span>
        </button>

        <div
          v-if="openFaqs.includes(idx)"
          class="p-4.5 pt-0 text-xs text-secondary leading-relaxed border-t border-neutral/40 bg-surface/50 space-y-2 animate-fade-in"
        >
          <div v-html="faq.answer"></div>
          <div v-if="faq.link" class="pt-2">
            <NuxtLink :to="faq.link.url" class="text-primary font-bold hover:underline inline-flex items-center gap-1">
              <span>{{ faq.link.text }} &rarr;</span>
            </NuxtLink>
          </div>
        </div>
      </div>

      <div v-if="filteredFaqs.length === 0" class="text-center py-12 card border-dashed border-neutral bg-surface">
        <div class="text-3xl mb-2">🔍</div>
        <div class="font-bold text-sm text-primary">No matching topics found</div>
        <div class="text-xs text-tertiary mt-1">Try another search term or send us a direct message.</div>
        <button class="btn btn-primary btn-xs mt-4" @click="openFeedbackModal">
          Contact Support
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'

const store = useWelloStore()
const searchQuery = ref('')
const selectedCategory = ref('all')
const openFaqs = ref([0, 1])

const categories = [
  { id: 'all', label: 'All Topics', icon: '📚' },
  { id: 'tracking', label: 'Timer & Rates', icon: '⏱️' },
  { id: 'invoicing', label: 'Invoicing & Payments', icon: '💳' },
  { id: 'addons', label: 'Free Addon Store', icon: '🛒' },
  { id: 'privacy', label: 'Privacy & Export', icon: '🔒' },
  { id: 'offline', label: 'PWA & Offline', icon: '📱' },
]

const faqs = [
  {
    category: 'tracking',
    icon: '⏱️',
    question: 'How does Wello calculate my Effective Hourly Rate?',
    answer: `Wello divides your net collected income by your total working hours. If you spend 20 hours on billable work ($2,000) and 5 hours on unpaid discovery/revision time, your true rate is <strong>$80/hr</strong> ($2,000 / 25h). This uncovers unpaid time leakage that traditional invoice tools hide.`,
    link: { text: 'View your analytics & reports', url: '/reports' },
  },
  {
    category: 'addons',
    icon: '🛒',
    question: 'Are store addons really 100% free?',
    answer: `<strong>Yes, every addon is 100% free forever.</strong> There are no paid tiers, no plans, and no billing processing for Wello itself. You can activate or deactivate any addon in one click from the Store page.`,
    link: { text: 'Explore Free Addons in Store', url: '/store' },
  },
  {
    category: 'invoicing',
    icon: '💳',
    question: 'How do client invoice payments link to my cash metrics?',
    answer: `When you record a payment against an invoice (whether bank transfer, cash, or Stripe), the payment record is linked directly to your single-source cash ledger. This prevents double-counting and ensures your cashflow figures are always audit-proof.`,
    link: { text: 'Open Invoicing', url: '/invoicing' },
  },
  {
    category: 'privacy',
    icon: '🔒',
    question: 'How can I export my data or delete my account?',
    answer: `You can download a complete ZIP bundle containing all your JSON and CSV files anytime from <strong>Settings &rarr; Data Management</strong>. If you decide to delete your account, Wello provides a 14-day grace period, followed by complete, irreversible erasure across all database tables.`,
    link: { text: 'Go to Data Settings', url: '/settings' },
  },
  {
    category: 'offline',
    icon: '📱',
    question: 'Can I track time and log payments while offline?',
    answer: `Yes! Wello is an installable Progressive Web App (PWA). All offline timer stops and entries are stored in a secure local outbox with idempotency keys and automatically synchronized to the server the moment your connection restores.`,
    link: { text: 'Learn about Offline Mode', url: '/settings' },
  },
  {
    category: 'tracking',
    icon: '💼',
    question: 'What is an Earning Persona?',
    answer: `Earning personas customize Wello's dashboard, metrics, and default free addons to match how you earn—whether you are a project freelancer, hourly contractor, creator, salaried employee, or multi-stream earner.`,
    link: { text: 'Configure Earning Persona', url: '/settings' },
  },
]

const filteredFaqs = computed(() => {
  return faqs.filter((f) => {
    const matchesCategory = selectedCategory.value === 'all' || f.category === selectedCategory.value
    const matchesSearch =
      !searchQuery.value.trim() ||
      f.question.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchesCategory && matchesSearch
  })
})

function toggleFaq(idx) {
  if (openFaqs.value.includes(idx)) {
    openFaqs.value = openFaqs.value.filter((i) => i !== idx)
  } else {
    openFaqs.value.push(idx)
  }
}

function openFeedbackModal() {
  store.showFeedbackModal = true
}
</script>
