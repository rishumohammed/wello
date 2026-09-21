<template>
  <div class="terms-page max-w-4xl mx-auto py-8 px-4 animate-fade-in">
    <div class="mb-8 pb-6 border-b border-neutral/60">
      <NuxtLink to="/work" class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary mb-4 hover:underline">
        <IconBack :size="14" />
        <span>Back to Application</span>
      </NuxtLink>
      <h1 class="text-3xl font-extrabold text-primary tracking-tight">Terms of Service</h1>
      <p class="text-xs text-tertiary mt-2">
        Last updated: September 21, 2026 &bull; Clear and transparent terms for all Wello users
      </p>
    </div>

    <div class="prose dark:prose-invert max-w-none text-xs leading-relaxed space-y-6 text-secondary">
      <section class="card p-6 border-neutral/60 bg-surface">
        <h2 class="text-base font-bold text-primary mb-2 flex items-center gap-2">
          <span>📜</span> 1. Service Description & Free Model
        </h2>
        <p>
          Wello provides modern time tracking, income analytics, project metrics, and client invoicing tools.
          All modular store addons and core capabilities in Wello are provided 100% free of charge without subscription fees, paywalls, or platform transaction commissions.
        </p>
      </section>

      <section class="card p-6 border-neutral/60 bg-surface">
        <h2 class="text-base font-bold text-primary mb-2 flex items-center gap-2">
          <span>👤</span> 2. Account Responsibility & Security
        </h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and one-time password (OTP) email authentication codes.
          You agree not to use Wello for unlawful purposes or to transmit malicious content.
        </p>
      </section>

      <section class="card p-6 border-neutral/60 bg-surface">
        <h2 class="text-base font-bold text-primary mb-2 flex items-center gap-2">
          <span>⚖️</span> 3. Fair-Use & Abuse Protection
        </h2>
        <p>
          To maintain high availability and performance for independent earners worldwide, Wello implements configurable fair-use abuse protection limits
          (e.g., maximum daily invoice generations, hourly PDF exports, and image upload thresholds). Exceeding these thresholds may temporarily rate-limit automated requests.
        </p>
      </section>

      <section class="card p-6 border-neutral/60 bg-surface">
        <h2 class="text-base font-bold text-primary mb-2 flex items-center gap-2">
          <span>💼</span> 4. User Ownership & Data Integrity
        </h2>
        <p>
          You retain 100% ownership of all data, client lists, work sessions, rates, and invoice documents created in Wello.
          You can export or purge your data at any time via Settings.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import IconBack from '~/components/IconBack.vue'
</script>
