<template>
  <div class="privacy-page max-w-4xl mx-auto py-8 px-4 animate-fade-in">
    <div class="mb-8 pb-6 border-b border-neutral/60">
      <NuxtLink to="/work" class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary mb-4 hover:underline">
        <IconBack :size="14" />
        <span>Back to Application</span>
      </NuxtLink>
      <h1 class="text-3xl font-extrabold text-primary tracking-tight">Privacy Policy</h1>
      <p class="text-xs text-tertiary mt-2">
        Last updated: September 21, 2026 &bull; Effective globally for all Wello users
      </p>
    </div>

    <div class="prose dark:prose-invert max-w-none text-xs leading-relaxed space-y-6 text-secondary">
      <section class="card p-6 border-neutral/60 bg-surface">
        <h2 class="text-base font-bold text-primary mb-2 flex items-center gap-2">
          <span>🔒</span> 1. Our Privacy Commitment & Zero-Monetization Guarantee
        </h2>
        <p>
          At Wello, we believe your personal earnings, working hours, client rosters, and financial records belong solely to you.
          <strong>Wello does not sell, rent, monetize, or broker your personal financial data to any third party.</strong>
          All platform addons and utilities are 100% free with zero platform subscription charges or ad tracking networks.
        </p>
      </section>

      <section class="card p-6 border-neutral/60 bg-surface">
        <h2 class="text-base font-bold text-primary mb-2 flex items-center gap-2">
          <span>📊</span> 2. Data We Collect & How We Use It
        </h2>
        <ul class="list-disc pl-5 space-y-1.5 text-tertiary">
          <li><strong>Account Information:</strong> Email address for secure one-time password (OTP) authentication and account recovery.</li>
          <li><strong>Work & Financial Data:</strong> Timers, work sessions, project scopes, client names, hourly rates, invoices, and payment records entered by you to compute effective hourly returns and financial reports.</li>
          <li><strong>Essential Operational Logs:</strong> Security logs, session tokens, and abuse prevention rate limits required to maintain service integrity.</li>
          <li><strong>Optional Analytics:</strong> Privacy-preserving aggregated telemetry to understand feature usage. You can opt out at any time from your Privacy Settings.</li>
        </ul>
      </section>

      <section class="card p-6 border-neutral/60 bg-surface">
        <h2 class="text-base font-bold text-primary mb-2 flex items-center gap-2">
          <span>🛡️</span> 3. Data Retention & Automated Purge Schedules
        </h2>
        <p>We enforce automated data retention policies to minimize data footprint:</p>
        <ul class="list-disc pl-5 space-y-1.5 text-tertiary mt-2">
          <li><strong>Login OTP Codes:</strong> Permanently purged 24 hours after issuance.</li>
          <li><strong>Revoked Auth Sessions:</strong> Removed after 30 days.</li>
          <li><strong>Raw Analytics Events:</strong> Pruned after 90 days (only anonymous daily aggregates retained).</li>
          <li><strong>Outbound Email Logs:</strong> Pruned after 90 days.</li>
        </ul>
      </section>

      <section class="card p-6 border-neutral/60 bg-surface">
        <h2 class="text-base font-bold text-primary mb-2 flex items-center gap-2">
          <span>📦</span> 4. Your Rights: Export, Reset, and Full Erasure (GDPR / CCPA)
        </h2>
        <p>Under global data privacy regulations (including GDPR, UK GDPR, and CCPA), you have absolute control over your information:</p>
        <ul class="list-disc pl-5 space-y-1.5 text-tertiary mt-2">
          <li><strong>Complete Portability & Export:</strong> Export all your records anytime in standard JSON and CSV format (or bundled ZIP) directly from Settings.</li>
          <li><strong>Work Data Reset:</strong> Wipe all your work sessions, invoices, and clients in 1 click while preserving your account login and free addon preferences.</li>
          <li><strong>Permanent Account Erasure:</strong> Delete your account with a 14-day grace period. Once the grace period expires, all records across all database tables tied to your user ID are permanently and irreversibly purged.</li>
        </ul>
      </section>

      <section class="card p-6 border-neutral/60 bg-surface">
        <h2 class="text-base font-bold text-primary mb-2 flex items-center gap-2">
          <span>📬</span> 5. Contact & Data Protection Officer
        </h2>
        <p>
          If you have questions about your privacy rights or wish to submit a data protection inquiry, contact our team via the in-app
          <NuxtLink to="/help" class="text-primary font-bold hover:underline">Help & Support</NuxtLink>
          portal or email <code>privacy@wello.app</code>.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import IconBack from '~/components/IconBack.vue'
</script>
