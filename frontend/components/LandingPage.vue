<template>
  <div class="landing-wrapper animate-fade-in">
    <!-- Ambient Floating Gradient Mesh Orbs -->
    <div class="ambient-orb orb-1"></div>
    <div class="ambient-orb orb-2"></div>
    <div class="ambient-orb orb-3"></div>
    <div class="ambient-orb orb-4"></div>

    <!-- Floating Glassmorphism Sticky Navbar -->
    <header class="landing-navbar">
      <div class="navbar-container">
        <!-- Brand Logo (Single image containing the full wordmark) -->
        <NuxtLink to="/" class="brand-logo-wrap" title="Wello Home">
          <img src="~/assets/logo.png" alt="Wello" class="brand-logo-img" />
        </NuxtLink>

        <!-- Desktop Navigation Links -->
        <nav class="nav-links-desktop">
          <a href="#features" class="nav-link">Features</a>
          <a href="#simulator" class="nav-link">Rate Simulator</a>
          <a href="#steps" class="nav-link">How It Works</a>
          <a href="#pricing" class="nav-link">Pricing</a>
          <a href="#faq" class="nav-link">FAQ</a>
        </nav>

        <!-- Navbar Actions -->
        <div class="nav-actions">
          <NuxtLink to="/login" class="btn-signin" id="landing-btn-signin">
            Sign In
          </NuxtLink>
          <NuxtLink to="/register" class="btn-trial-cta" id="landing-btn-register-top">
            <span>Start 90-Day Free Trial</span>
            <span class="cta-arrow">→</span>
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="landing-content">
      <!-- ───────────────────────────────────────────────────────────────── -->
      <!-- 1. HERO SECTION                                                   -->
      <!-- ───────────────────────────────────────────────────────────────── -->
      <section class="hero-section">
        <div class="hero-container">
          <div class="hero-badge animate-fade-in">
            <span class="badge-sparkle">✨</span>
            <span>90-DAY UNRESTRICTED FREE TRIAL · ZERO CARD REQUIRED</span>
          </div>

          <h1 class="hero-headline">
            Maximize the Real <br />
            <span class="gradient-text">Economic Value of Your Time</span>
          </h1>

          <p class="hero-subheadline">
            The financial intelligence platform engineered for freelancers, consultants, and independent professionals.
            Reveal your true take-home hourly yield, eliminate unbilled leakage, and send global client invoices.
          </p>

          <div class="hero-cta-group">
            <NuxtLink to="/register" class="btn-hero-primary" id="hero-btn-start-trial">
              <span>Start Your 90-Day Free Trial</span>
              <span class="cta-arrow">→</span>
            </NuxtLink>
            <a href="#simulator" class="btn-hero-secondary">
              <span>Try Live Rate Simulator ↓</span>
            </a>
          </div>

          <div class="hero-trust-row">
            <span class="trust-pill">🔒 256-Bit Data Privacy</span>
            <span class="trust-pill">🌐 150+ ISO Currencies</span>
            <span class="trust-pill">⚡ Offline-First PWA</span>
            <span class="trust-pill">💳 No Credit Card Upfront</span>
          </div>

          <!-- Hero Vector Dashboard & Cockpit Showcase Illustration -->
          <div class="hero-cockpit-wrap animate-fade-in">
            <div class="hero-cockpit-glass">
              <!-- Top Mock Browser / Cockpit Status Header -->
              <div class="cockpit-bar">
                <div class="cockpit-dots">
                  <span class="c-dot red"></span>
                  <span class="c-dot yellow"></span>
                  <span class="c-dot green"></span>
                </div>
                <div class="cockpit-badge">
                  <span class="pulse-green-dot"></span>
                  <span>WELLO TIME-EQUITY INTELLIGENCE · LIVE SIMULATION</span>
                </div>
                <div class="cockpit-stat-pill">
                  <span>Target: $75.00/h</span>
                </div>
              </div>

              <!-- Main Vector Visual Canvas -->
              <div class="cockpit-canvas">
                <svg viewBox="0 0 840 330" class="cockpit-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="heroGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#FF9F1C" />
                      <stop offset="45%" stop-color="#FF387D" />
                      <stop offset="100%" stop-color="#7A3FF6" />
                    </linearGradient>
                    <linearGradient id="heroGradGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#7A3FF6" stop-opacity="0.22" />
                      <stop offset="100%" stop-color="#7A3FF6" stop-opacity="0.0" />
                    </linearGradient>
                  </defs>

                  <!-- Dashed Horizontal Target Reference & Grid Lines -->
                  <line x1="60" y1="110" x2="780" y2="110" stroke="#7A3FF6" stroke-width="1.5" stroke-dasharray="6 6" opacity="0.4" />
                  <text x="80" y="100" fill="#7A3FF6" font-size="11" font-weight="800" letter-spacing="0.6">TARGET HOURLY RATE: $75.00 / HR</text>

                  <line x1="60" y1="200" x2="780" y2="200" stroke="rgba(122,63,246,0.06)" stroke-dasharray="5 5" />
                  <line x1="60" y1="270" x2="780" y2="270" stroke="rgba(122,63,246,0.06)" stroke-dasharray="5 5" />

                  <!-- Central Dial Indicator Ring -->
                  <circle cx="230" cy="180" r="50" stroke="rgba(122,63,246,0.09)" stroke-width="8" />
                  <circle cx="230" cy="180" r="50" stroke="url(#heroGrad1)" stroke-width="8" stroke-dasharray="314" stroke-dashoffset="65" stroke-linecap="round" class="gauge-ring-spin" />
                  <text x="230" y="176" text-anchor="middle" font-size="22" font-weight="900" fill="#0F172A" letter-spacing="-0.5">$84.50</text>
                  <text x="230" y="196" text-anchor="middle" font-size="9.5" font-weight="800" fill="#64748B" letter-spacing="0.6">TRUE YIELD</text>

                  <!-- Shaded Glow Area Under Curve -->
                  <path d="M 140 260 C 260 235, 360 190, 480 140 C 560 105, 620 120, 720 80 L 720 280 L 140 280 Z" fill="url(#heroGradGlow)" />

                  <!-- Main Growth Vector Curve -->
                  <path d="M 140 260 C 260 235, 360 190, 480 140 C 560 105, 620 120, 720 80" stroke="url(#heroGrad1)" stroke-width="4.5" stroke-linecap="round" class="anim-curve" />

                  <!-- Circular Ring Nodes Matching Reference Mockup -->
                  <circle cx="475" cy="205" r="9" stroke="#FF387D" stroke-width="3.5" fill="none" opacity="0.8" class="pulse-point-subtle" />
                  <circle cx="680" cy="145" r="9" stroke="#7A3FF6" stroke-width="3.5" fill="none" opacity="0.8" class="pulse-point-subtle" />
                </svg>

                <!-- Floating Interactive Vector Badge Overlays -->
                <div class="floating-vector-card card-top-left float-slow">
                  <div class="f-card-bracket bracket-purple"></div>
                  <div class="f-card-icon purple">💎</div>
                  <div class="f-card-content">
                    <div class="f-card-title">Client-Work Yield</div>
                    <div class="f-card-val text-purple">$84.50 <span class="f-card-unit">/ hr</span></div>
                    <div class="f-card-sub text-success">▲ +14.2% above target</div>
                  </div>
                </div>

                <div class="floating-vector-card card-top-right float-slow-reverse">
                  <div class="f-card-bracket bracket-orange"></div>
                  <div class="f-card-icon orange">⚠️</div>
                  <div class="f-card-content">
                    <div class="f-card-title">Leakage Intercepted</div>
                    <div class="f-card-val text-warning">-$1,150 <span class="f-card-unit">recovered</span></div>
                    <div class="f-card-sub text-tertiary">14h unbilled revisions fixed</div>
                  </div>
                </div>

                <div class="floating-vector-card card-bottom-center float-slow-center">
                  <div class="f-card-bracket bracket-green"></div>
                  <div class="f-card-icon green">🌐</div>
                  <div class="f-card-content flex-card-row">
                    <div>
                      <div class="f-card-title">Global Retainer Settled</div>
                      <div class="f-card-val text-dark">$4,500 <span class="text-tertiary text-xs">⇄ €4,120 · ₹3.78L</span></div>
                    </div>
                    <span class="cockpit-tag-paid">✓ Auto Settled</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ───────────────────────────────────────────────────────────────── -->
      <!-- 2. INTERACTIVE LIVE RATE SIMULATOR (HERO SHOWCASE)                -->
      <!-- ───────────────────────────────────────────────────────────────── -->
      <section id="simulator" class="simulator-section">
        <div class="landing-section-container">
          <div class="landing-section-header">
            <span class="landing-section-badge">INTERACTIVE PROOF</span>
            <h2 class="landing-section-title">The Real Hourly Rate Dilemma</h2>
            <p class="landing-section-subtitle">
              Most professionals believe they earn their quoted rate. See how revision hours, pitches, and overhead expenses secretly dilute your take-home yield.
            </p>
          </div>

          <div class="simulator-card-glass">
            <div class="simulator-grid">
              <!-- Controls on the Left -->
              <div class="simulator-controls">
                <div class="control-group">
                  <div class="control-label-row">
                    <label for="sim-income">Monthly Billed Income</label>
                    <span class="control-val">${{ simRevenue.toLocaleString() }}</span>
                  </div>
                  <input
                    id="sim-income"
                    type="range"
                    min="1000"
                    max="20000"
                    step="250"
                    v-model.number="simRevenue"
                    class="sim-range-input"
                  />
                  <div class="range-limits">
                    <span>$1k</span>
                    <span>$10k</span>
                    <span>$20k</span>
                  </div>
                </div>

                <div class="control-group">
                  <div class="control-label-row">
                    <label for="sim-paid-hours">Direct Client Work Hours</label>
                    <span class="control-val">{{ simPaidHours }} hrs</span>
                  </div>
                  <input
                    id="sim-paid-hours"
                    type="range"
                    min="20"
                    max="180"
                    step="5"
                    v-model.number="simPaidHours"
                    class="sim-range-input"
                  />
                  <div class="range-limits">
                    <span>20 hrs</span>
                    <span>100 hrs</span>
                    <span>180 hrs</span>
                  </div>
                </div>

                <div class="control-group">
                  <div class="control-label-row">
                    <label for="sim-unpaid-hours">Unbilled Friction Hours (Scope Creep, Pitches, Revisions)</label>
                    <span class="control-val text-warning">{{ simUnpaidHours }} hrs</span>
                  </div>
                  <input
                    id="sim-unpaid-hours"
                    type="range"
                    min="0"
                    max="60"
                    step="2"
                    v-model.number="simUnpaidHours"
                    class="sim-range-input warning"
                  />
                  <div class="range-limits">
                    <span>0 hrs</span>
                    <span>30 hrs</span>
                    <span>60 hrs</span>
                  </div>
                </div>

                <div class="control-group">
                  <div class="control-label-row">
                    <label for="sim-overhead">Monthly Software & Tools Overhead</label>
                    <span class="control-val">${{ simOverhead }}</span>
                  </div>
                  <input
                    id="sim-overhead"
                    type="range"
                    min="0"
                    max="2000"
                    step="50"
                    v-model.number="simOverhead"
                    class="sim-range-input"
                  />
                  <div class="range-limits">
                    <span>$0</span>
                    <span>$1,000</span>
                    <span>$2,000</span>
                  </div>
                </div>
              </div>

              <!-- Real-time Math Output on the Right -->
              <div class="simulator-results">
                <div class="result-glass-card highlight-client">
                  <div class="result-header">
                    <span class="result-label">Client-Work Rate ($R_{\text{client\_work}}$)</span>
                    <span class="badge-formula">Net Income / Total Client Hours</span>
                  </div>
                  <div class="result-number-row">
                    <span class="result-currency">$</span>
                    <span class="result-val">{{ simClientRate }}</span>
                    <span class="result-unit">/ hr</span>
                  </div>
                  <div class="result-caption">What you actually earned for every hour spent on client work.</div>
                </div>

                <div class="result-glass-card highlight-allin">
                  <div class="result-header">
                    <span class="result-label">All-In True Yield ($R_{\text{all\_in}}$)</span>
                    <span class="badge-formula">Net Income / All Worked Time</span>
                  </div>
                  <div class="result-number-row">
                    <span class="result-currency">$</span>
                    <span class="result-val">{{ simAllInRate }}</span>
                    <span class="result-unit">/ hr</span>
                  </div>
                  <div class="result-caption">Your holistic return factoring all non-billable overhead & admin work.</div>
                </div>

                <div class="leakage-alert-card">
                  <div class="leakage-icon">⚠️</div>
                  <div>
                    <div class="leakage-title">Unpaid Time Revenue Leakage</div>
                    <div class="leakage-amount">${{ simLeakageValue }} lost per month</div>
                    <div class="leakage-desc">
                      You are losing {{ simLeakagePercent }}% of your potential earnings to uncharged friction.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="simulator-footer-cta">
              <span>Wello tracks this in real-time across every project, timer, and invoice.</span>
              <NuxtLink to="/register" class="btn-sim-action">
                <span>Start Tracking with Wello Pro →</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <!-- ───────────────────────────────────────────────────────────────── -->
      <!-- 3. CORE FEATURES (THE 4 PILLARS) WITH BESPOKE VECTOR GRAPHICS     -->
      <!-- ───────────────────────────────────────────────────────────────── -->
      <section id="features" class="features-section">
        <div class="landing-section-container">
          <div class="landing-section-header">
            <span class="landing-section-badge">DESIGNED FOR PROFITABILITY</span>
            <h2 class="landing-section-title">Everything Solo Professionals Need</h2>
            <p class="landing-section-subtitle">
              Built from first principles to give you total clarity over your revenue, client health, and time equity.
            </p>
          </div>

          <div class="features-grid">
            <!-- Feature 1: Dual Rate Intelligence -->
            <div class="feature-card-glass">
              <div class="feature-visual-vector">
                <svg viewBox="0 0 240 100" class="feature-svg" fill="none">
                  <path d="M10 80 C 60 75, 100 40, 160 30 C 190 25, 210 20, 230 15" stroke="url(#heroGrad1)" stroke-width="3" stroke-linecap="round" />
                  <path d="M10 80 C 60 85, 100 70, 160 65 C 190 62, 210 58, 230 50" stroke="#007BFF" stroke-width="2.5" stroke-dasharray="4 4" stroke-linecap="round" />
                  <circle cx="230" cy="15" r="5" fill="#FFFFFF" stroke="#7A3FF6" stroke-width="2.5" />
                  <circle cx="230" cy="50" r="4" fill="#FFFFFF" stroke="#007BFF" stroke-width="2" />
                  <rect x="130" y="8" width="92" height="20" rx="10" fill="rgba(122,63,246,0.1)" stroke="rgba(122,63,246,0.25)" />
                  <text x="176" y="22" text-anchor="middle" font-size="9" font-weight="800" fill="#7A3FF6">R_client ($84/h)</text>
                </svg>
              </div>
              <div class="feature-icon-box purple">
                <IconCalculator :size="22" />
              </div>
              <h3 class="feature-title">Dual Hourly Rate Intelligence</h3>
              <p class="feature-desc">
                Automatically calculate $R_{\text{client\_work}}$ and $R_{\text{all\_in}}$ to discover your true take-home hourly yield after taxes, tool costs, and overhead.
              </p>
              <div class="feature-tag">Smart Mathematical Modeling</div>
            </div>

            <!-- Feature 2: Leakage Detection -->
            <div class="feature-card-glass">
              <div class="feature-visual-vector">
                <svg viewBox="0 0 240 100" class="feature-svg" fill="none">
                  <!-- Radar concentric circles -->
                  <circle cx="120" cy="50" r="42" stroke="rgba(245,158,11,0.2)" stroke-width="1.5" />
                  <circle cx="120" cy="50" r="26" stroke="rgba(245,158,11,0.3)" stroke-width="1.5" />
                  <circle cx="120" cy="50" r="10" stroke="#F59E0B" stroke-width="2" fill="rgba(245,158,11,0.2)" />
                  <!-- Radar sweep line -->
                  <line x1="120" y1="50" x2="160" y2="20" stroke="#EF4444" stroke-width="2" stroke-linecap="round" class="anim-radar" />
                  <!-- Intercepted Leakage Badge -->
                  <rect x="140" y="60" width="88" height="20" rx="10" fill="rgba(239,68,68,0.12)" stroke="rgba(239,68,68,0.3)" />
                  <text x="184" y="74" text-anchor="middle" font-size="9" font-weight="800" fill="#DC2626">-$1,150 Saved</text>
                </svg>
              </div>
              <div class="feature-icon-box sunrise">
                <IconClock :size="22" />
              </div>
              <h3 class="feature-title">Revenue Leakage Detection</h3>
              <p class="feature-desc">
                Identify runaway client revisions, unpaid discovery calls, and administrative friction before they silently erode your monthly profitability.
              </p>
              <div class="feature-tag">Scope Creep Defense</div>
            </div>

            <!-- Feature 3: Global Invoicing -->
            <div class="feature-card-glass">
              <div class="feature-visual-vector">
                <svg viewBox="0 0 240 100" class="feature-svg" fill="none">
                  <!-- Currency Triad Orbit -->
                  <ellipse cx="120" cy="50" rx="65" ry="24" stroke="rgba(0,123,255,0.25)" stroke-width="1.5" stroke-dasharray="4 4" />
                  <circle cx="65" cy="50" r="14" fill="#FFFFFF" stroke="#007BFF" stroke-width="2" />
                  <text x="65" y="54" text-anchor="middle" font-size="11" font-weight="800" fill="#007BFF">$</text>
                  <circle cx="120" cy="26" r="14" fill="#FFFFFF" stroke="#7A3FF6" stroke-width="2" />
                  <text x="120" y="30" text-anchor="middle" font-size="11" font-weight="800" fill="#7A3FF6">€</text>
                  <circle cx="175" cy="50" r="14" fill="#FFFFFF" stroke="#059669" stroke-width="2" />
                  <text x="175" y="54" text-anchor="middle" font-size="11" font-weight="800" fill="#059669">₹</text>
                </svg>
              </div>
              <div class="feature-icon-box blue">
                <IconReceipt :size="22" />
              </div>
              <h3 class="feature-title">Global Invoicing & Retainers</h3>
              <p class="feature-desc">
                Send professional multi-currency invoices with live triangular FX conversion, custom tax regimes, and automated recurring retainers.
              </p>
              <div class="feature-tag">150+ ISO 4217 Currencies</div>
            </div>

            <!-- Feature 4: Private Financial Ledger -->
            <div class="feature-card-glass">
              <div class="feature-visual-vector">
                <svg viewBox="0 0 240 100" class="feature-svg" fill="none">
                  <!-- Shield & Cryptographic Vault Box -->
                  <rect x="75" y="15" width="90" height="70" rx="14" fill="#FFFFFF" stroke="rgba(255,56,125,0.3)" stroke-width="2" />
                  <path d="M120 30 L140 40 V58 C140 70 120 78 120 78 C120 78 100 70 100 58 V40 Z" fill="rgba(255,56,125,0.12)" stroke="#FF387D" stroke-width="2" />
                  <circle cx="120" cy="52" r="3" fill="#FF387D" />
                  <path d="M120 55 V61" stroke="#FF387D" stroke-width="2" stroke-linecap="round" />
                  <text x="120" y="93" text-anchor="middle" font-size="8" font-weight="800" fill="#FF387D" letter-spacing="0.5">256-BIT ENCRYPTION</text>
                </svg>
              </div>
              <div class="feature-icon-box pink">
                <IconShield :size="22" />
              </div>
              <h3 class="feature-title">Private Financial Ledger</h3>
              <p class="feature-desc">
                Zero third-party telemetry or ad-trackers. Server-authoritative timer tracking, offline-first IndexedDB sync, and tamper-evident audit history.
              </p>
              <div class="feature-tag">100% Personal Privacy</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ───────────────────────────────────────────────────────────────── -->
      <!-- 4. HOW IT WORKS (3 SIMPLE STEPS) WITH BESPOKE VECTOR GRAPHICS     -->
      <!-- ───────────────────────────────────────────────────────────────── -->
      <section id="steps" class="steps-section">
        <div class="landing-section-container">
          <div class="landing-section-header">
            <span class="landing-section-badge">SIMPLE 3-STEP WORKFLOW</span>
            <h2 class="landing-section-title">How Wello Transforms Your Workflow</h2>
            <p class="landing-section-subtitle">
              From day one, Wello turns everyday time tracking into actionable revenue intelligence.
            </p>
          </div>

          <div class="steps-grid">
            <!-- Step 1 -->
            <div class="step-card-glass">
              <div class="step-card-vector">
                <svg viewBox="0 0 160 80" class="step-svg" fill="none">
                  <circle cx="80" cy="40" r="30" stroke="rgba(122,63,246,0.15)" stroke-width="4" />
                  <circle cx="80" cy="40" r="30" stroke="#7A3FF6" stroke-width="4" stroke-dasharray="188" stroke-dashoffset="60" stroke-linecap="round" class="anim-timer-sweep" />
                  <polygon points="76,32 88,40 76,48" fill="#7A3FF6" />
                </svg>
              </div>
              <div class="step-num-badge">01</div>
              <h3 class="step-title">Track Time with Ease</h3>
              <p class="step-desc">
                Start a live timer with 1-click or log quick entries on mobile with forgotten-timer protection.
              </p>
            </div>

            <!-- Step 2 -->
            <div class="step-card-glass">
              <div class="step-card-vector">
                <svg viewBox="0 0 160 80" class="step-svg" fill="none">
                  <rect x="30" y="20" width="100" height="40" rx="10" fill="rgba(255,159,28,0.1)" stroke="rgba(255,159,28,0.4)" stroke-width="1.5" />
                  <text x="80" y="44" text-anchor="middle" font-size="12" font-weight="900" fill="#FF9F1C">R = Net / Σt</text>
                  <circle cx="20" cy="40" r="4" fill="#FF9F1C" class="pulse-point" />
                  <circle cx="140" cy="40" r="4" fill="#FF9F1C" class="pulse-point" />
                </svg>
              </div>
              <div class="step-num-badge">02</div>
              <h3 class="step-title">Automate Yield Equations</h3>
              <p class="step-desc">
                Wello connects settled payments, tax rates, and software expenses to compute your true hourly yield.
              </p>
            </div>

            <!-- Step 3 -->
            <div class="step-card-glass">
              <div class="step-card-vector">
                <svg viewBox="0 0 160 80" class="step-svg" fill="none">
                  <path d="M25 60 Q 70 55, 100 35 T 145 15" stroke="url(#heroGrad1)" stroke-width="3" stroke-linecap="round" />
                  <circle cx="145" cy="15" r="5" fill="#059669" />
                  <text x="145" y="32" text-anchor="middle" font-size="9" font-weight="800" fill="#059669">PROFIT ↑</text>
                </svg>
              </div>
              <div class="step-num-badge">03</div>
              <h3 class="step-title">Quote for Maximum Profit</h3>
              <p class="step-desc">
                Use empirical rate intelligence to quote fixed-price proposals and retainers that guarantee your target rate.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- ───────────────────────────────────────────────────────────────── -->
      <!-- 5. PRICING & 90-DAY FREE TRIAL                                    -->
      <!-- ───────────────────────────────────────────────────────────────── -->
      <section id="pricing" class="pricing-section">
        <div class="landing-section-container">
          <div class="landing-section-header">
            <span class="landing-section-badge">TRANSPARENT PRICING</span>
            <h2 class="landing-section-title">One Simple, Transparent Plan</h2>
            <p class="landing-section-subtitle">
              Enjoy 90 full days of unrestricted access on us. No hidden tiers, no usage caps.
            </p>
          </div>

          <div class="pricing-card-wrapper">
            <div class="pricing-card-glass">
              <div class="pricing-badge-popular">
                <span>⭐ 90-DAY ALL-ACCESS FREE TRIAL</span>
              </div>

              <div class="pricing-card-top">
                <div class="plan-name">Wello Pro Membership</div>
                <div class="plan-desc">For freelancers, solo founders, and consultants demanding full financial clarity.</div>
                <div class="plan-price-block">
                  <span class="price-curr">$</span>
                  <span class="price-val">1</span>
                  <span class="price-freq">/ month</span>
                  <span class="price-alt">base</span>
                </div>
                
                <!-- Transparent Billing Breakdown -->
                <div class="landing-price-breakdown">
                  <div class="landing-breakdown-row">
                    <span>Base Membership:</span>
                    <strong>$1.00</strong>
                  </div>
                  <div class="landing-breakdown-row">
                    <span>Statutory Tax (18% GST / VAT):</span>
                    <strong>+$0.18</strong>
                  </div>
                  <div class="landing-breakdown-row">
                    <span>Payment Gateway Processing (2%):</span>
                    <strong>+$0.03</strong>
                  </div>
                  <div class="landing-breakdown-divider"></div>
                  <div class="landing-breakdown-row total">
                    <span>Total Billed at Checkout:</span>
                    <strong class="text-purple">~$1.21 / mo (or ₹107.12)</strong>
                  </div>
                </div>

                <div class="price-trial-note">90 Days 100% Free · No upfront card required · Cancel anytime</div>
              </div>

              <div class="pricing-features-list">
                <div class="feature-check-item">
                  <IconCheck :size="16" class="check-icon" />
                  <span>Unlimited projects, clients, and work session logging</span>
                </div>
                <div class="feature-check-item">
                  <IconCheck :size="16" class="check-icon" />
                  <span>Dual Headline Rate Intelligence ($R_{\text{client\_work}}$ & $R_{\text{all\_in}}$)</span>
                </div>
                <div class="feature-check-item">
                  <IconCheck :size="16" class="check-icon" />
                  <span>Revenue leakage & unpaid friction hour audits</span>
                </div>
                <div class="feature-check-item">
                  <IconCheck :size="16" class="check-icon" />
                  <span>Global multi-currency invoicing with triangular FX conversion</span>
                </div>
                <div class="feature-check-item">
                  <IconCheck :size="16" class="check-icon" />
                  <span>Offline-first PWA synchronization with IndexedDB outbox</span>
                </div>
                <div class="feature-check-item">
                  <IconCheck :size="16" class="check-icon" />
                  <span>Soft-lock data guarantee (your historical data is never deleted)</span>
                </div>
              </div>

              <NuxtLink to="/register" class="btn-pricing-cta" id="pricing-btn-start-trial">
                <span>Start Your 90-Day Free Trial</span>
                <span class="cta-arrow">→</span>
              </NuxtLink>

              <div class="pricing-guarantee-row">
                <span>🔒 Secure Razorpay Mandate</span>
                <span>⚡ Instant Activation</span>
                <span>💎 Cancel Anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ───────────────────────────────────────────────────────────────── -->
      <!-- 6. FAQ SECTION                                                    -->
      <!-- ───────────────────────────────────────────────────────────────── -->
      <section id="faq" class="faq-section">
        <div class="landing-section-container">
          <div class="landing-section-header">
            <span class="landing-section-badge">COMMON QUESTIONS</span>
            <h2 class="landing-section-title">Frequently Asked Questions</h2>
            <p class="landing-section-subtitle">
              Everything you need to know about your 90-day trial and the Wello platform.
            </p>
          </div>

          <div class="faq-accordion">
            <div
              v-for="(item, idx) in faqItems"
              :key="idx"
              class="faq-item-glass"
              :class="{ open: openFaqIndex === idx }"
              @click="toggleFaq(idx)"
            >
              <div class="faq-question-row">
                <span class="faq-question">{{ item.q }}</span>
                <span class="faq-icon">{{ openFaqIndex === idx ? '−' : '+' }}</span>
              </div>
              <div v-if="openFaqIndex === idx" class="faq-answer animate-fade-in">
                {{ item.a }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ───────────────────────────────────────────────────────────────── -->
      <!-- 7. FINAL CALL TO ACTION BANNER                                    -->
      <!-- ───────────────────────────────────────────────────────────────── -->
      <section class="final-cta-section">
        <div class="final-cta-card-glass">
          <div class="final-cta-content">
            <h2 class="final-cta-title">
              Ready to Take Control of Your <br />
              <span class="gradient-text">Real Hourly Earnings?</span>
            </h2>
            <p class="final-cta-sub">
              Join independent professionals worldwide who maximize their true take-home yield with Wello.
            </p>
            <NuxtLink to="/register" class="btn-final-cta" id="final-btn-start-trial">
              <span>Claim Your 90-Day Free Trial Now</span>
              <span class="cta-arrow">→</span>
            </NuxtLink>
            <div class="final-micro-text">Zero credit card required to start · 2-minute frictionless setup</div>
          </div>
        </div>
      </section>
    </main>

    <!-- ───────────────────────────────────────────────────────────────── -->
    <!-- 8. MARKETING FOOTER (PREMIUM DARK OBSIDIAN THEME)                 -->
    <!-- ───────────────────────────────────────────────────────────────── -->
    <footer class="landing-footer">
      <div class="footer-ambient-glow"></div>

      <div class="footer-container">
        <!-- Main Top Row -->
        <div class="footer-top">
          <!-- Column 1: Brand & Status -->
          <div class="footer-brand-col">
            <NuxtLink to="/" class="brand-logo-wrap" title="Wello Home">
              <img src="~/assets/logo.png" alt="Wello" class="brand-logo-img" />
            </NuxtLink>
            <p class="footer-brand-desc">
              The financial intelligence and work-value platform engineered for solo professionals, consultants, and independent creators.
            </p>
            
            <div class="footer-status-pill">
              <span class="pulse-green-dot"></span>
              <span>All Systems Operational · v1.0 Global</span>
            </div>

            <div class="footer-security-tags">
              <span class="sec-tag">🔒 256-Bit SSL</span>
              <span class="sec-tag">⚡ Zero Ad-Trackers</span>
              <span class="sec-tag">🛡️ Soft-Lock Safe</span>
            </div>
          </div>

          <!-- Links Grid (4 balanced columns) -->
          <div class="footer-links-grid">
            <div class="footer-col">
              <div class="footer-col-title">Work Intelligence</div>
              <a href="#features" class="footer-link">Dual Hourly Rates</a>
              <a href="#simulator" class="footer-link">Rate Dilution Simulator</a>
              <a href="#features" class="footer-link">Revenue Leakage Radar</a>
              <NuxtLink to="/work" class="footer-link">Live Session Timers</NuxtLink>
              <NuxtLink to="/calculator" class="footer-link">Pricing Calculator</NuxtLink>
            </div>

            <div class="footer-col">
              <div class="footer-col-title">Monetization</div>
              <NuxtLink to="/invoicing" class="footer-link">Multi-Currency Invoicing</NuxtLink>
              <NuxtLink to="/invoicing" class="footer-link">Recurring Retainers</NuxtLink>
              <a href="#features" class="footer-link">150+ ISO Currencies</a>
              <NuxtLink to="/reports" class="footer-link">Rate Yield Reports</NuxtLink>
              <NuxtLink to="/store" class="footer-link">Wello Addon Store</NuxtLink>
            </div>

            <div class="footer-col">
              <div class="footer-col-title">Company & Legal</div>
              <a href="#pricing" class="footer-link">Transparent Pricing ($1/mo)</a>
              <NuxtLink to="/help" class="footer-link">Help & Documentation</NuxtLink>
              <NuxtLink to="/privacy" class="footer-link">Privacy Policy</NuxtLink>
              <NuxtLink to="/terms" class="footer-link">Terms of Service</NuxtLink>
              <NuxtLink to="/settings" class="footer-link">Security Settings</NuxtLink>
            </div>

            <!-- Footer Mini-CTA Card -->
            <div class="footer-cta-card">
              <div class="footer-cta-badge">⭐ 90 DAYS ON US</div>
              <div class="footer-cta-title">Start Free Trial</div>
              <div class="footer-cta-sub">Full unrestricted access for 90 days. Zero upfront card required.</div>
              <NuxtLink to="/register" class="btn-footer-cta" id="footer-btn-register">
                <span>Start 90-Day Trial</span>
                <span>→</span>
              </NuxtLink>
              <div class="footer-cta-micro">Takes 2 minutes · Cancel anytime</div>
            </div>
          </div>
        </div>

        <!-- Bottom Bar -->
        <div class="footer-bottom">
          <div class="footer-bottom-left">
            <span>&copy; {{ new Date().getFullYear() }} Wello Inc. All rights reserved.</span>
            <span class="footer-divider-dot">·</span>
            <span>Engineered for solo professionals worldwide.</span>
          </div>

          <div class="footer-bottom-right">
            <span class="bottom-spec-badge">🌐 150+ ISO Currencies</span>
            <span class="bottom-spec-badge">🕒 IANA Timezones</span>
            <a href="#" class="back-to-top-btn" title="Back to top">↑ Top</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import IconCalculator from '~/components/IconCalculator.vue'
import IconClock from '~/components/IconClock.vue'
import IconReceipt from '~/components/IconReceipt.vue'
import IconShield from '~/components/IconShield.vue'
import IconCheck from '~/components/IconCheck.vue'

// Live Simulator State
const simRevenue = ref(7500)
const simPaidHours = ref(90)
const simUnpaidHours = ref(25)
const simOverhead = ref(450)

const simClientRate = computed(() => {
  const net = simRevenue.value - simOverhead.value
  const totalClientHours = simPaidHours.value + simUnpaidHours.value
  if (totalClientHours <= 0) return '0.00'
  return (net / totalClientHours).toFixed(2)
})

const simAllInRate = computed(() => {
  const net = simRevenue.value - simOverhead.value
  const totalHours = simPaidHours.value + simUnpaidHours.value + 15 // factoring intentional/admin hours
  if (totalHours <= 0) return '0.00'
  return (net / totalHours).toFixed(2)
})

const simLeakageValue = computed(() => {
  const unbilled = simUnpaidHours.value
  const rate = Number(simClientRate.value) || 0
  return Math.round(unbilled * rate).toLocaleString()
})

const simLeakagePercent = computed(() => {
  const total = simPaidHours.value + simUnpaidHours.value
  if (total <= 0) return 0
  return Math.round((simUnpaidHours.value / total) * 100)
})

// FAQ Accordion State
const openFaqIndex = ref(0)
function toggleFaq(idx) {
  openFaqIndex.value = openFaqIndex.value === idx ? -1 : idx
}

const faqItems = [
  {
    q: 'How does the 90-day free trial work?',
    a: 'Every new user account is automatically granted 90 days of full, unrestricted access to Wello Pro upon registration. You can track unlimited work sessions, generate professional invoices, calculate rate yields, and connect your workflow with zero restrictions.',
  },
  {
    q: 'Do I need a credit card to sign up?',
    a: 'No! Registration is completely frictionless with zero payment details required upfront. You only decide whether to subscribe when your 90-day trial is nearing its end.',
  },
  {
    q: 'What happens when my 90-day trial ends?',
    a: 'Wello guarantees full soft-lock data safety. You will never lose access to your historical sessions, clients, invoices, or reports. When the trial ends, active timer tracking and new invoice creation prompt you to subscribe, but your existing data is 100% accessible and exportable anytime.',
  },
  {
    q: 'Does Wello support my country, currency, and timezone?',
    a: 'Yes. Wello is engineered region-agnostic. It supports all 150+ ISO 4217 currencies (USD, EUR, GBP, INR, CAD, AUD, JPY, etc.), daily triangular exchange rates, and IANA timezone boundaries without hardcoded regional assumptions.',
  },
  {
    q: 'How does the $1/month pricing, taxes, and payment gateway charges work?',
    a: 'Wello Pro is priced at a base rate of $1.00 USD (or equivalent INR ₹89.00) per month. During checkout, statutory taxes (such as 18% GST / digital VAT) and payment gateway processing fees (~2%) are computed transparently with zero hidden markups, bringing the total monthly charge to approximately $1.21 / month.',
  },
  {
    q: 'How are the two hourly rate metrics calculated?',
    a: 'Wello calculates two rates: (1) Client-Work Rate: Net income divided by paid and unpaid client hours (showing true project yield); (2) All-In Rate: Net income divided by total worked time including administrative, research, and non-billable hours.',
  },
]
</script>

<style scoped>
/* ─────────────────────────────────────────────────────────────────────────── */
/* WRAPPER & AMBIENT MESH ORBS                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
.landing-wrapper {
  position: relative;
  min-height: 100vh;
  background: #FAFAFC;
  color: #111827;
  font-family: var(--font-family);
  overflow-x: hidden;
}

.ambient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.65;
}

.orb-1 {
  top: -120px;
  left: -80px;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(255, 159, 28, 0.35) 0%, rgba(255, 56, 125, 0.25) 50%, transparent 70%);
}

.orb-2 {
  top: 100px;
  right: -100px;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(122, 63, 246, 0.35) 0%, rgba(0, 123, 255, 0.2) 60%, transparent 75%);
}

.orb-3 {
  top: 1400px;
  left: 10%;
  width: 550px;
  height: 550px;
  background: radial-gradient(circle, rgba(255, 56, 125, 0.25) 0%, rgba(122, 63, 246, 0.2) 50%, transparent 70%);
}

.orb-4 {
  bottom: 300px;
  right: 5%;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(255, 159, 28, 0.25) 0%, rgba(122, 63, 246, 0.25) 60%, transparent 70%);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* FLOATING GLASS NAVBAR                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */
.landing-navbar {
  position: sticky;
  top: 16px;
  z-index: 100;
  max-width: 1140px;
  margin: 0 auto;
  padding: 0 16px;
}

.navbar-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-full);
  padding: 10px 24px;
  box-shadow: 0 10px 30px rgba(17, 24, 39, 0.06), 0 1px 4px rgba(122, 63, 246, 0.04);
}

.brand-logo-wrap {
  display: flex;
  align-items: center;
  text-decoration: none;
}

.brand-logo-img {
  height: 32px;
  width: auto;
  object-fit: contain;
}

.nav-links-desktop {
  display: flex;
  align-items: center;
  gap: 28px;
}

@media (max-width: 768px) {
  .nav-links-desktop {
    display: none;
  }
}

.nav-link {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.nav-link:hover {
  color: var(--color-purple);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-signin {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
  padding: 8px 16px;
  border-radius: var(--radius-full);
  transition: all var(--transition-fast);
}

.btn-signin:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-purple);
}

.btn-trial-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--grad-brand);
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 700;
  padding: 9px 20px;
  border-radius: var(--radius-full);
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(122, 63, 246, 0.3);
  transition: all var(--transition-apple-ease);
}

.btn-trial-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(122, 63, 246, 0.45);
}

.cta-arrow {
  transition: transform var(--transition-fast);
}

.btn-trial-cta:hover .cta-arrow {
  transform: translateX(3px);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* HERO SECTION                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */
.hero-section {
  position: relative;
  z-index: 1;
  padding: 80px 20px 50px;
  text-align: center;
}

.hero-container {
  max-width: 880px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(122, 63, 246, 0.3);
  padding: 6px 16px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 800;
  color: var(--color-purple);
  letter-spacing: 0.5px;
  margin-bottom: 24px;
  box-shadow: 0 4px 16px rgba(122, 63, 246, 0.1);
  backdrop-filter: blur(12px);
}

.hero-headline {
  font-size: 56px;
  font-weight: 800;
  line-height: 1.15;
  color: var(--text-primary);
  letter-spacing: -1.5px;
  margin-bottom: 20px;
  text-align: center;
}

@media (max-width: 768px) {
  .hero-headline {
    font-size: 38px;
    letter-spacing: -0.8px;
  }
}

.gradient-text {
  background: var(--grad-brand);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subheadline {
  font-size: 18px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 720px;
  margin: 0 auto 36px;
  text-align: center;
}

@media (max-width: 768px) {
  .hero-subheadline {
    font-size: 15px;
  }
}

.hero-cta-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 36px;
}

.btn-hero-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--grad-brand);
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 700;
  padding: 14px 32px;
  border-radius: var(--radius-full);
  text-decoration: none;
  box-shadow: 0 8px 26px rgba(122, 63, 246, 0.35);
  transition: all var(--transition-apple-ease);
}

.btn-hero-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 36px rgba(122, 63, 246, 0.5);
}

.btn-hero-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  padding: 14px 28px;
  border-radius: var(--radius-full);
  text-decoration: none;
  backdrop-filter: blur(12px);
  transition: all var(--transition-fast);
}

.btn-hero-secondary:hover {
  background: #FFFFFF;
  border-color: var(--color-purple);
  color: var(--color-purple);
}

.hero-trust-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.trust-pill {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  backdrop-filter: blur(8px);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* HERO VECTOR DASHBOARD & COCKPIT SHOWCASE                                   */
/* ─────────────────────────────────────────────────────────────────────────── */
.hero-cockpit-wrap {
  margin-top: 52px;
  width: 100%;
  max-width: 960px;
  position: relative;
  z-index: 2;
}

.hero-cockpit-glass {
  background: #FFFFFF;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 28px;
  overflow: hidden;
  box-shadow: 0 28px 70px -12px rgba(122, 63, 246, 0.12), 0 10px 30px -4px rgba(15, 23, 42, 0.05);
  position: relative;
}

.cockpit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
  background: rgba(255, 255, 255, 0.98);
  border-bottom: 1px solid rgba(241, 245, 249, 0.9);
  gap: 16px;
}

.cockpit-dots {
  display: flex;
  align-items: center;
  gap: 8px;
}

.c-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.c-dot.red { background: #EF4444; }
.c-dot.yellow { background: #F59E0B; }
.c-dot.green { background: #10B981; }

.cockpit-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.6px;
  color: #7A3FF6;
  background: #F3EEFF;
  border: 1px solid rgba(122, 63, 246, 0.18);
  padding: 5px 16px;
  border-radius: 20px;
}

.pulse-green-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 8px #10B981;
  animation: anim-pulse-green 1.8s infinite;
}

.cockpit-stat-pill {
  font-size: 13px;
  font-weight: 700;
  color: #475569;
}

.cockpit-canvas {
  position: relative;
  padding: 30px 24px 44px;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFFFFF;
}

.cockpit-svg {
  width: 100%;
  height: auto;
  max-height: 320px;
}

.floating-vector-card {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #FFFFFF;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 18px;
  padding: 12px 18px 12px 16px;
  box-shadow: 0 16px 36px -6px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04);
  z-index: 10;
  text-align: left;
  overflow: hidden;
}

.f-card-bracket {
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 4.5px;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
  border-top-left-radius: 18px;
  border-bottom-left-radius: 18px;
}

.bracket-purple { background: linear-gradient(180deg, #7A3FF6 0%, #3B82F6 100%); }
.bracket-orange { background: linear-gradient(180deg, #F59E0B 0%, #EA580C 100%); }
.bracket-green  { background: linear-gradient(180deg, #10B981 0%, #059669 100%); }

.card-top-left {
  top: 24px;
  left: 36px;
}

.card-top-right {
  top: 28px;
  right: 36px;
}

.card-bottom-center {
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
}

@media (max-width: 820px) {
  .card-top-left, .card-top-right, .card-bottom-center {
    position: static;
    transform: none !important;
    margin: 8px 0;
    width: 100%;
  }
  .cockpit-canvas {
    flex-direction: column;
    padding: 20px 16px;
  }
}

.f-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.f-card-icon.purple { background: #EDE9FE; }
.f-card-icon.orange { background: #FEF3C7; }
.f-card-icon.green  { background: #CCFBF1; }

.f-card-content {
  display: flex;
  flex-direction: column;
}

.f-card-title {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748B;
  margin-bottom: 2px;
}

.f-card-val {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
}

.f-card-val.text-purple { color: #7C3AED; }
.f-card-val.text-warning { color: #D97706; }
.f-card-val.text-dark { color: #0F172A; }

.f-card-unit {
  font-size: 11px;
  font-weight: 600;
  color: #64748B;
}

.f-card-sub {
  font-size: 10.5px;
  font-weight: 700;
  margin-top: 1px;
}

.flex-card-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.cockpit-tag-paid {
  font-size: 11px;
  font-weight: 800;
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 4px 10px;
  border-radius: 20px;
  white-space: nowrap;
}

.pulse-point-subtle {
  animation: pulseRing 3s ease-in-out infinite alternate;
  transform-origin: center;
}

@keyframes pulseRing {
  0% { transform: scale(0.95); opacity: 0.65; }
  100% { transform: scale(1.15); opacity: 1; }
}

/* Feature & Step Vector Graphics Styles */
.feature-visual-vector {
  margin-bottom: 12px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-svg {
  width: 100%;
  max-width: 220px;
  height: auto;
}

.step-card-vector {
  margin-bottom: 10px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-svg {
  width: 100%;
  max-width: 140px;
  height: auto;
}

/* Keyframe Animations */
@keyframes float-slow {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}

@keyframes float-slow-reverse {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(8px); }
}

@keyframes float-slow-center {
  0%, 100% { transform: translate(-50%, 0px); }
  50% { transform: translate(-50%, -6px); }
}

@keyframes anim-pulse-green {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.6; }
}

@keyframes gauge-ring-spin {
  0% { stroke-dashoffset: 140; }
  50% { stroke-dashoffset: 80; }
  100% { stroke-dashoffset: 140; }
}

@keyframes anim-radar {
  0% { transform: rotate(0deg); transform-origin: 120px 50px; }
  100% { transform: rotate(360deg); transform-origin: 120px 50px; }
}

@keyframes anim-timer-sweep {
  0% { stroke-dashoffset: 188; }
  50% { stroke-dashoffset: 50; }
  100% { stroke-dashoffset: 188; }
}

.float-slow {
  animation: float-slow 5s ease-in-out infinite;
}

.float-slow-reverse {
  animation: float-slow-reverse 6s ease-in-out infinite;
}

.float-slow-center {
  animation: float-slow-center 5.5s ease-in-out infinite;
}

.gauge-ring-spin {
  animation: gauge-ring-spin 6s ease-in-out infinite;
}

.anim-radar {
  animation: anim-radar 4s linear infinite;
}

.anim-timer-sweep {
  animation: anim-timer-sweep 4s ease-in-out infinite;
}

.pulse-point {
  animation: anim-pulse-green 3s ease-in-out infinite;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* SECTION LAYOUT & HEADERS (CLEAN VERTICAL CENTERING)                        */
/* ─────────────────────────────────────────────────────────────────────────── */
.simulator-section,
.features-section,
.steps-section,
.pricing-section,
.faq-section {
  position: relative;
  z-index: 1;
  padding: 70px 20px;
}

.landing-section-container {
  max-width: 1080px;
  margin: 0 auto;
}

.landing-section-header {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  text-align: center !important;
  max-width: 720px;
  margin: 0 auto 48px auto !important;
}

.landing-section-badge {
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.8px;
  color: var(--color-purple);
  background: rgba(122, 63, 246, 0.08);
  border: 1px solid rgba(122, 63, 246, 0.2);
  padding: 4px 14px;
  border-radius: var(--radius-full);
  margin-bottom: 8px;
}

.landing-section-title {
  font-size: 38px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -1px;
  line-height: 1.2;
  margin: 8px 0 12px 0;
  text-align: center;
}

@media (max-width: 768px) {
  .landing-section-title {
    font-size: 28px;
  }
}

.landing-section-subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  line-height: 1.6;
  text-align: center;
  margin: 0;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* SIMULATOR GLASS CARD                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */
.simulator-card-glass {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-2xl);
  padding: 36px 40px;
  box-shadow: 0 16px 48px rgba(17, 24, 39, 0.08), 0 2px 8px rgba(122, 63, 246, 0.06);
}

@media (max-width: 768px) {
  .simulator-card-glass {
    padding: 24px;
  }
}

.simulator-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 36px;
}

@media (max-width: 860px) {
  .simulator-grid {
    grid-template-columns: 1fr;
  }
}

.simulator-controls {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.control-val {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-purple);
}

.sim-range-input {
  width: 100%;
  accent-color: var(--color-purple);
  cursor: pointer;
}

.sim-range-input.warning {
  accent-color: #D97706;
}

.range-limits {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.simulator-results {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-glass-card {
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
}

.result-glass-card.highlight-client {
  border-left: 4px solid var(--color-purple);
}

.result-glass-card.highlight-allin {
  border-left: 4px solid var(--color-blue);
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.result-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}

.badge-formula {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  background: var(--color-off-white);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.result-number-row {
  display: flex;
  align-items: baseline;
  gap: 2px;
  line-height: 1;
  margin-bottom: 6px;
}

.result-currency {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.result-val {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}

.result-unit {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-left: 4px;
}

.result-caption {
  font-size: 11px;
  color: var(--text-tertiary);
}

.leakage-alert-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
}

.leakage-icon {
  font-size: 20px;
}

.leakage-title {
  font-size: 12px;
  font-weight: 700;
  color: #B45309;
}

.leakage-amount {
  font-size: 16px;
  font-weight: 800;
  color: #D97706;
  margin: 2px 0;
}

.leakage-desc {
  font-size: 11px;
  color: #92400E;
}

.simulator-footer-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 30px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
  flex-wrap: wrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.btn-sim-action {
  background: var(--grad-brand);
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 700;
  padding: 10px 22px;
  border-radius: var(--radius-full);
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(122, 63, 246, 0.3);
  transition: all var(--transition-fast);
}

.btn-sim-action:hover {
  transform: translateY(-1px);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* FEATURES GRID                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

@media (max-width: 768px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
}

.feature-card-glass {
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-xl);
  padding: 28px 30px;
  box-shadow: 0 10px 30px rgba(17, 24, 39, 0.04);
  transition: all var(--transition-apple-ease);
}

.feature-card-glass:hover {
  transform: translateY(-3px);
  background: #FFFFFF;
  border-color: rgba(122, 63, 246, 0.3);
  box-shadow: 0 16px 40px rgba(122, 63, 246, 0.1);
}

.feature-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
}

.feature-icon-box.purple  { background: rgba(122, 63, 246, 0.12); color: var(--color-purple); }
.feature-icon-box.sunrise { background: rgba(255, 159, 28, 0.14); color: #FF9F1C; }
.feature-icon-box.blue    { background: rgba(0, 123, 255, 0.12); color: #007BFF; }
.feature-icon-box.pink    { background: rgba(255, 56, 125, 0.12); color: #FF387D; }

.feature-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: -0.2px;
}

.feature-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}

.feature-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-purple);
  background: rgba(122, 63, 246, 0.08);
  padding: 3px 10px;
  border-radius: var(--radius-full);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* STEPS GRID                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

@media (max-width: 768px) {
  .steps-grid {
    grid-template-columns: 1fr;
  }
}

.step-card-glass {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-xl);
  padding: 28px 24px;
  position: relative;
}

.step-num-badge {
  font-size: 28px;
  font-weight: 900;
  color: var(--color-purple);
  opacity: 0.25;
  margin-bottom: 10px;
}

.step-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.step-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* PRICING SECTION                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */
.pricing-card-wrapper {
  max-width: 580px;
  margin: 0 auto;
}

.pricing-card-glass {
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(28px);
  border: 2px solid var(--color-purple);
  border-radius: var(--radius-2xl);
  padding: 40px 36px;
  box-shadow: 0 20px 60px rgba(122, 63, 246, 0.14);
  position: relative;
  text-align: center;
}

.pricing-badge-popular {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--grad-brand);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 5px 18px;
  border-radius: var(--radius-full);
  box-shadow: 0 4px 14px rgba(122, 63, 246, 0.35);
}

.plan-name {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  margin-top: 10px;
  margin-bottom: 4px;
}

.plan-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.plan-price-block {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  line-height: 1;
}

.price-curr {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.price-val {
  font-size: 56px;
  font-weight: 900;
  letter-spacing: -1.5px;
  color: var(--text-primary);
}

.price-freq {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.price-alt {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-purple);
  background: rgba(122, 63, 246, 0.1);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  margin-left: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.landing-price-breakdown {
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  margin: 16px auto 14px;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.landing-breakdown-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}

.landing-breakdown-row strong {
  color: var(--text-primary);
  font-weight: 700;
}

.landing-breakdown-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.landing-breakdown-row.total {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.price-trial-note {
  font-size: 12px;
  font-weight: 700;
  color: #059669;
  margin-top: 10px;
  margin-bottom: 26px;
}

.pricing-features-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
  margin-bottom: 32px;
  padding: 20px;
  background: var(--color-off-white);
  border-radius: var(--radius-lg);
}

.feature-check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.check-icon {
  color: var(--color-success);
  flex-shrink: 0;
}

.btn-pricing-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  background: var(--grad-brand);
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 700;
  padding: 15px 24px;
  border-radius: var(--radius-lg);
  text-decoration: none;
  box-shadow: 0 8px 24px rgba(122, 63, 246, 0.4);
  transition: all var(--transition-apple-ease);
}

.btn-pricing-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(122, 63, 246, 0.55);
}

.pricing-guarantee-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-top: 16px;
  flex-wrap: wrap;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* FAQ ACCORDION                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
.faq-accordion {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 760px;
  margin: 0 auto;
}

.faq-item-glass {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 18px 22px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.faq-item-glass:hover {
  background: #FFFFFF;
  border-color: rgba(122, 63, 246, 0.3);
}

.faq-question-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.faq-question {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.faq-icon {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-purple);
}

.faq-answer {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* FINAL CTA SECTION                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */
.final-cta-section {
  padding: 40px 20px 80px;
  position: relative;
  z-index: 1;
}

.final-cta-card-glass {
  max-width: 960px;
  margin: 0 auto;
  background: linear-gradient(135deg, rgba(255, 159, 28, 0.12) 0%, rgba(255, 56, 125, 0.12) 50%, rgba(122, 63, 246, 0.14) 100%);
  border: 1px solid rgba(122, 63, 246, 0.3);
  backdrop-filter: blur(24px);
  border-radius: var(--radius-2xl);
  padding: 60px 40px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(122, 63, 246, 0.12);
}

.final-cta-title {
  font-size: 40px;
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: -0.8px;
  color: var(--text-primary);
  margin-bottom: 14px;
}

@media (max-width: 768px) {
  .final-cta-title {
    font-size: 28px;
  }
}

.final-cta-sub {
  font-size: 16px;
  color: var(--text-secondary);
  max-width: 600px;
  margin: 0 auto 30px;
  line-height: 1.5;
}

.btn-final-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--grad-brand);
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 700;
  padding: 15px 36px;
  border-radius: var(--radius-full);
  text-decoration: none;
  box-shadow: 0 8px 28px rgba(122, 63, 246, 0.4);
  transition: all var(--transition-apple-ease);
}

.btn-final-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 38px rgba(122, 63, 246, 0.55);
}

.final-micro-text {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 14px;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* FOOTER (PREMIUM LIGHT GLASSMORPHISM THEME)                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
.landing-footer {
  position: relative;
  z-index: 2;
  background: linear-gradient(180deg, #FFFFFF 0%, #F8F9FC 35%, #EFF2F8 100%);
  color: var(--text-primary);
  overflow: hidden;
  padding: 80px 24px 36px;
  border-top: 1px solid rgba(0, 0, 0, 0.07);
}

.landing-footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--grad-brand);
  opacity: 0.85;
}

.footer-ambient-glow {
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  width: 900px;
  height: 350px;
  background: radial-gradient(circle at center, rgba(122, 63, 246, 0.08) 0%, rgba(255, 159, 28, 0.05) 50%, transparent 70%);
  pointer-events: none;
  filter: blur(50px);
}

.footer-container {
  max-width: 1160px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.footer-top {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 56px;
  align-items: start;
}

.footer-brand-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.footer-brand-desc {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.65;
  margin: 0;
}

.footer-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #059669;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 11.5px;
  font-weight: 700;
  width: fit-content;
}

.pulse-green-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 8px #10B981;
  animation: pulseGlow 2s infinite ease-in-out;
}

@keyframes pulseGlow {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
    box-shadow: 0 0 8px #10B981;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.7;
    box-shadow: 0 0 14px #10B981;
  }
}

.footer-security-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.sec-tag {
  background: #FFFFFF;
  border: 1px solid rgba(0, 0, 0, 0.07);
  color: var(--text-secondary);
  padding: 5px 11px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.footer-links-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(130px, 1fr)) 240px;
  gap: 32px;
  align-items: start;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.footer-col-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.footer-link {
  font-size: 13.5px;
  color: var(--text-secondary);
  text-decoration: none;
  display: inline-block;
  line-height: 1.4;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.footer-link:hover {
  color: var(--color-purple);
  transform: translateX(4px);
}

/* Footer Mini CTA Card */
.footer-cta-card {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 245, 255, 0.95) 100%);
  border: 1px solid rgba(122, 63, 246, 0.22);
  border-radius: 18px;
  padding: 22px 18px;
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 10px 30px rgba(122, 63, 246, 0.08), 0 2px 8px rgba(0, 0, 0, 0.03);
}

.footer-cta-badge {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.6px;
  color: #B45309;
  background: #FEF3C7;
  border: 1px solid #FDE68A;
  padding: 3px 8px;
  border-radius: 6px;
  width: fit-content;
}

.footer-cta-title {
  font-size: 15.5px;
  font-weight: 800;
  color: var(--text-primary);
}

.footer-cta-sub {
  font-size: 11.5px;
  color: var(--text-secondary);
  line-height: 1.45;
}

.btn-footer-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--grad-brand);
  color: #FFFFFF;
  font-size: 12.5px;
  font-weight: 700;
  padding: 10px 14px;
  border-radius: 10px;
  text-decoration: none;
  margin-top: 4px;
  box-shadow: 0 4px 16px rgba(122, 63, 246, 0.35);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.btn-footer-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(122, 63, 246, 0.5);
}

.footer-cta-micro {
  font-size: 10.5px;
  color: var(--text-tertiary);
  text-align: center;
  margin-top: 2px;
}

/* Footer Bottom Bar */
.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 30px;
  margin-top: 52px;
  border-top: 1px solid rgba(0, 0, 0, 0.07);
  font-size: 12.5px;
  color: var(--text-tertiary);
  flex-wrap: wrap;
  gap: 16px;
}

.footer-bottom-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.footer-divider-dot {
  color: rgba(0, 0, 0, 0.2);
}

.footer-bottom-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.bottom-spec-badge {
  background: #FFFFFF;
  border: 1px solid rgba(0, 0, 0, 0.07);
  color: var(--text-secondary);
  padding: 5px 11px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.back-to-top-btn {
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 8px;
  background: #FFFFFF;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.back-to-top-btn:hover {
  color: var(--color-purple);
  border-color: var(--color-purple);
  background: #F8F5FF;
}

/* Responsive Footer Breakdown */
@media (max-width: 1080px) {
  .footer-top {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .footer-links-grid {
    grid-template-columns: repeat(3, minmax(130px, 1fr)) 240px;
  }
}

@media (max-width: 860px) {
  .footer-links-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 28px;
  }

  .footer-cta-card {
    grid-column: span 2;
  }
}

@media (max-width: 580px) {
  .landing-footer {
    padding: 60px 16px 28px;
  }

  .footer-links-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .footer-cta-card {
    grid-column: span 1;
  }

  .footer-bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-top: 36px;
    padding-top: 24px;
  }
}
</style>
