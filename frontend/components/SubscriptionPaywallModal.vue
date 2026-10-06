<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close" id="paywall-modal-overlay">
    <div class="modal modal-lg paywall-modal" id="paywall-modal-container">
      <!-- Modal Header with Brand Banner -->
      <div class="paywall-header-banner">
        <div class="banner-glow-1"></div>
        <div class="banner-glow-2"></div>
        <div class="paywall-header-content">
          <div class="paywall-badge">
            <span class="sparkle">✨</span>
            <span>WELLO PRO MEMBERSHIP</span>
          </div>
          <h2 class="paywall-title">Maximize the Economic Value of Your Time</h2>
          <p class="paywall-subtitle">
            Unlimited work session tracking, dual hourly rate intelligence, client invoicing, and financial protection.
          </p>
        </div>
        <button type="button" class="modal-close paywall-close-btn" @click="close" id="paywall-modal-close" aria-label="Close">
          <IconX :size="18" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body paywall-body">
        <!-- Trial Status Callout (if active) -->
        <div v-if="billingState.isTrialActive" class="trial-info-box mb-4">
          <div class="trial-info-left">
            <span class="trial-info-icon">⏳</span>
            <div>
              <div class="fw-700 text-xs text-primary">{{ billingState.daysLeftInTrial }} Days Remaining in Your Free Trial</div>
              <div class="text-2xs text-secondary">Upgrade now to secure uninterrupted access across all your client projects.</div>
            </div>
          </div>
        </div>

        <div v-else-if="billingState.isSoftLocked" class="trial-expired-box mb-4">
          <div class="trial-info-left">
            <span class="trial-info-icon">🔒</span>
            <div>
              <div class="fw-700 text-xs text-error">Your 90-Day Free Trial Has Concluded</div>
              <div class="text-2xs text-secondary">Your historical data is safely saved. Subscribe below to continue logging work and issuing invoices.</div>
            </div>
          </div>
        </div>

        <!-- Value Features Grid -->
        <div class="features-grid mb-6">
          <div class="feature-item-card">
            <div class="feature-icon-box purple">
              <IconCalculator :size="18" />
            </div>
            <div class="feature-text-wrap">
              <div class="feature-name">Dual Headline Hourly Rates</div>
              <div class="feature-desc">Real-time $R_{\text{client\_work}}$ & $R_{\text{all\_in}}$ math revealing true take-home earnings.</div>
            </div>
          </div>

          <div class="feature-item-card">
            <div class="feature-icon-box orange">
              <IconClock :size="18" />
            </div>
            <div class="feature-text-wrap">
              <div class="feature-name">Revenue Leakage Detection</div>
              <div class="feature-desc">Unmask unpaid friction hours from revisions, pitches, and scope creep.</div>
            </div>
          </div>

          <div class="feature-item-card">
            <div class="feature-icon-box blue">
              <IconFileText :size="18" />
            </div>
            <div class="feature-text-wrap">
              <div class="feature-name">Multi-Currency Invoicing</div>
              <div class="feature-desc">Send professional invoices, credit notes, and automated retainer billing.</div>
            </div>
          </div>

          <div class="feature-item-card">
            <div class="feature-icon-box pink">
              <IconShield :size="18" />
            </div>
            <div class="feature-text-wrap">
              <div class="feature-name">Private Financial Ledger</div>
              <div class="feature-desc">Zero ads, offline-first PWA synchronization, and tamper-proof security.</div>
            </div>
          </div>
        </div>

        <!-- Plan Pricing Card with Itemized Tax & Gateway Fee Breakdown -->
        <div class="pricing-card mb-4">
          <div class="pricing-card-left">
            <div class="plan-tag">TRANSPARENT MONTHLY PRICING</div>
            <div class="plan-price-row">
              <span class="currency-symbol">{{ planCurrencySymbol }}</span>
              <span class="price-number">{{ basePriceDisplay }}</span>
              <span class="price-interval">/ month</span>
              <span class="price-base-tag">base</span>
            </div>
            
            <!-- Itemized Breakdown -->
            <div class="pricing-breakdown-box">
              <div class="breakdown-row">
                <span class="breakdown-label">Base Subscription:</span>
                <span class="breakdown-val">{{ planCurrencySymbol }}{{ basePriceDisplay }}</span>
              </div>
              <div class="breakdown-row">
                <span class="breakdown-label">Statutory Tax (GST / VAT {{ taxRatePct }}%):</span>
                <span class="breakdown-val">+{{ planCurrencySymbol }}{{ taxAmountDisplay }}</span>
              </div>
              <div class="breakdown-row">
                <span class="breakdown-label">Payment Gateway Processing ({{ gatewayFeeRatePct }}%):</span>
                <span class="breakdown-val">+{{ planCurrencySymbol }}{{ gatewayFeeDisplay }}</span>
              </div>
              <div class="breakdown-divider"></div>
              <div class="breakdown-row total-row">
                <span class="breakdown-label fw-700">Total Billed Monthly:</span>
                <span class="breakdown-val fw-800 text-purple">{{ planCurrencySymbol }}{{ totalAmountDisplay }}</span>
              </div>
            </div>

            <div class="plan-sub-note">Recurring monthly billing · Cancel anytime in 1-click with zero penalty.</div>
          </div>
          <div class="pricing-card-right">
            <button
              type="button"
              class="btn btn-primary btn-lg subscribe-action-btn"
              :disabled="isLoading"
              @click="handleSubscribe"
              id="paywall-btn-subscribe"
            >
              <span v-if="isLoading" class="btn-loader mr-2"></span>
              <span class="fw-700">{{ isLoading ? 'Preparing Checkout…' : `Activate Wello Pro (${planCurrencySymbol}${totalAmountDisplay}) →` }}</span>
            </button>
          </div>
        </div>

        <div class="guarantee-row">
          <span class="guarantee-item">🔒 Secure 256-Bit Razorpay Encryption</span>
          <span class="guarantee-item">💳 UPI Autopay, Cards, Netbanking</span>
          <span class="guarantee-item">⚡ Instant Activation</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'
import IconX from '~/components/IconX.vue'
import IconCalculator from '~/components/IconCalculator.vue'
import IconClock from '~/components/IconClock.vue'
import IconFileText from '~/components/IconFileText.vue'
import IconShield from '~/components/IconShield.vue'

const welloStore = useWelloStore()
const toast = useToast()

const isOpen = computed(() => welloStore.showPaywallModal)
const billingState = computed(() => welloStore.billing || {
  status: 'trialing',
  isTrialActive: true,
  daysLeftInTrial: 90,
  plan: {
    baseAmount: 1.00,
    taxRatePct: 18.0,
    taxAmount: 0.18,
    gatewayFeeRatePct: 2.0,
    gatewayFeeAmount: 0.03,
    amount: 1.21,
    currency: 'USD',
  },
})

const isLoading = ref(false)

const planCurrency = computed(() => billingState.value.plan?.currency || 'USD')

const planCurrencySymbol = computed(() => {
  const c = planCurrency.value
  if (c === 'INR') return '₹'
  if (c === 'USD') return '$'
  if (c === 'EUR') return '€'
  if (c === 'GBP') return '£'
  return c + ' '
})

const basePriceDisplay = computed(() => {
  const p = billingState.value.plan
  if (p?.baseAmount !== undefined) return Number(p.baseAmount).toFixed(2)
  if (planCurrency.value === 'INR') return '89.00'
  return '1.00'
})

const taxRatePct = computed(() => {
  return billingState.value.plan?.taxRatePct || 18.0
})

const taxAmountDisplay = computed(() => {
  const p = billingState.value.plan
  if (p?.taxAmount !== undefined) return Number(p.taxAmount).toFixed(2)
  const base = Number(basePriceDisplay.value)
  return ((base * taxRatePct.value) / 100).toFixed(2)
})

const gatewayFeeRatePct = computed(() => {
  return billingState.value.plan?.gatewayFeeRatePct || 2.0
})

const gatewayFeeDisplay = computed(() => {
  const p = billingState.value.plan
  if (p?.gatewayFeeAmount !== undefined) return Number(p.gatewayFeeAmount).toFixed(2)
  const base = Number(basePriceDisplay.value)
  return Math.max(0.03, (base * gatewayFeeRatePct.value) / 100).toFixed(2)
})

const totalAmountDisplay = computed(() => {
  const p = billingState.value.plan
  if (p?.amount !== undefined) return Number(p.amount).toFixed(2)
  const base = Number(basePriceDisplay.value)
  const tax = Number(taxAmountDisplay.value)
  const fee = Number(gatewayFeeDisplay.value)
  return (base + tax + fee).toFixed(2)
})

function close() {
  welloStore.showPaywallModal = false
}

async function handleSubscribe() {
  isLoading.value = true
  try {
    const checkoutData = await welloStore.initiateSubscriptionCheckout()
    
    // Check if Razorpay SDK script is loaded
    if (typeof window !== 'undefined') {
      if (!window.Razorpay) {
        await loadRazorpayScript()
      }

      if (window.Razorpay) {
        const options = {
          key: checkoutData.keyId,
          subscription_id: checkoutData.subscriptionId,
          name: checkoutData.name || 'Wello Pro',
          description: checkoutData.description || 'Monthly Subscription',
          image: '/logo.png',
          prefill: checkoutData.prefill || {},
          theme: {
            color: '#7A3FF6',
          },
          handler: async function (response) {
            toast.show('Payment successful! Synchronizing subscription…', 'success')
            await welloStore.fetchBillingStatus()
            close()
          },
          modal: {
            ondismiss: function () {
              isLoading.value = false
            },
          },
        }

        const rzp = new window.Razorpay(options)
        rzp.open()
      } else {
        // Dev fallback simulation
        toast.show('Simulating subscription activation (Sandbox mode)…', 'info')
        setTimeout(async () => {
          await welloStore.fetchBillingStatus()
          toast.show('Wello Pro subscription active!', 'success')
          isLoading.value = false
          close()
        }, 1200)
      }
    }
  } catch (err) {
    toast.show(err?.message || 'Failed to initialize subscription checkout', 'error')
    isLoading.value = false
  }
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}
</script>

<style scoped>
.paywall-modal {
  max-width: 680px;
  border-radius: var(--radius-2xl);
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-color);
}

.paywall-header-banner {
  background: linear-gradient(135deg, #111827 0%, #1E1B4B 50%, #311042 100%);
  color: var(--color-white);
  padding: 32px 28px;
  position: relative;
  overflow: hidden;
}

.banner-glow-1 {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255, 159, 28, 0.25) 0%, transparent 70%);
  pointer-events: none;
}

.banner-glow-2 {
  position: absolute;
  bottom: -40px;
  left: -40px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(122, 63, 246, 0.3) 0%, transparent 70%);
  pointer-events: none;
}

.paywall-header-content {
  position: relative;
  z-index: 2;
  max-width: 540px;
}

.paywall-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  margin-bottom: 12px;
  backdrop-filter: blur(8px);
}

.paywall-title {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.25;
  color: #FFFFFF;
  letter-spacing: -0.4px;
  margin-bottom: 8px;
}

.paywall-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
  margin: 0;
}

.paywall-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.15);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  z-index: 10;
  border: none;
}

.paywall-close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  color: #FFFFFF;
}

.paywall-body {
  padding: 24px 28px;
}

.trial-info-box {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.trial-expired-box {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.trial-info-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.trial-info-icon {
  font-size: 20px;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

@media (max-width: 600px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
}

.feature-item-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background: var(--color-off-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.feature-item-card:hover {
  background: var(--color-white);
  border-color: var(--color-gray-300);
}

.feature-icon-box {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-icon-box.purple { background: rgba(122, 63, 246, 0.12); color: var(--color-purple); }
.feature-icon-box.orange { background: rgba(255, 159, 28, 0.12); color: var(--color-sunrise); }
.feature-icon-box.blue   { background: rgba(0, 123, 255, 0.12); color: var(--color-blue); }
.feature-icon-box.pink   { background: rgba(255, 56, 125, 0.12); color: var(--color-pink); }

.feature-text-wrap {
  flex: 1;
  min-width: 0;
}

.feature-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.feature-desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.pricing-card {
  background: var(--color-off-white);
  border: 2px solid var(--color-purple);
  border-radius: var(--radius-xl);
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  box-shadow: 0 4px 16px rgba(122, 63, 246, 0.08);
}

@media (max-width: 600px) {
  .pricing-card {
    flex-direction: column;
    align-items: stretch;
  }
}

.plan-tag {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.8px;
  color: var(--color-purple);
  margin-bottom: 4px;
}

.plan-price-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  line-height: 1;
}

.currency-symbol {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.price-number {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -1px;
  color: var(--text-primary);
}

.price-interval {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-left: 2px;
}

.price-base-tag {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-purple);
  background: rgba(122, 63, 246, 0.1);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  margin-left: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pricing-breakdown-box {
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  margin: 12px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.breakdown-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}

.breakdown-label {
  font-weight: 500;
}

.breakdown-val {
  font-weight: 700;
  color: var(--text-primary);
}

.breakdown-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.breakdown-row.total-row {
  font-size: 13px;
  color: var(--text-primary);
}

.plan-sub-note {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.subscribe-action-btn {
  padding: 12px 28px;
  font-size: 14px;
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 16px rgba(122, 63, 246, 0.35);
}

.guarantee-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 8px;
}

.guarantee-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
