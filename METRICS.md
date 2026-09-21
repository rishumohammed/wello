# Wello — Metrics & Mathematical Formulas Specification

This document details the exact mathematical formulations, operational constraints, and edge-case handling implementations across the Wello calculation engines ([`backend/utils/metricsEngine.ts`](backend/utils/metricsEngine.ts), [`backend/utils/fxService.ts`](backend/utils/fxService.ts), and [`backend/utils/taxService.ts`](backend/utils/taxService.ts)).

---

## 1. Dual Hourly Rate System

Wello computes two distinct, complementary rate figures for every user:

### A. Target Hourly Rate ($R_{\text{target}}$)
The planned baseline hourly rate configured by the user in their profile settings.
$$\text{Target Rate} = R_{\text{target}}$$

### B. Effective All-In Hourly Rate ($R_{\text{effective}}$)
The true realized yield of a professional's time, accounting for all billable hours, non-billable overhead hours, non-project income, direct project expenses, and operational overhead deductions.

$$R_{\text{effective}} = \frac{\text{Net Realized Revenue}}{\text{Total Worked Hours}} = \frac{Y_{\text{collected}} + Y_{\text{other}} - E_{\text{direct}} - E_{\text{overhead}}}{H_{\text{billable}} + H_{\text{unbillable}}}$$

Where:
- $Y_{\text{collected}}$: Total revenue actually received/collected in cash from client payments.
- $Y_{\text{other}}$: Net income received from non-project income streams (e.g. royalties, retainers, teaching).
- $E_{\text{direct}}$: Direct expenses incurred specifically on client projects (e.g. domain fees, subcontracts).
- $E_{\text{overhead}}$: Prorated recurring operational overhead expenses (e.g. software subscriptions, hardware depreciation).
- $H_{\text{billable}}$: Total hours logged on billable client milestones.
- $H_{\text{unbillable}}$: Total non-billable hours logged (proposals, administrative, revisions, client calls).

---

## 2. Rate Variance & Status Classification

Rate variance measures the percentage divergence between the user's realized effective rate and their target rate.

$$\text{Variance \%} = \frac{R_{\text{effective}} - R_{\text{target}}}{R_{\text{target}}} \times 100$$

### Variance Classification Matrix

| Variance Condition | Status Identifier | UI Badge Color | Actionable Insight |
| :--- | :--- | :--- | :--- |
| $\text{Variance} \ge +15\%$ | `ABOVE_TARGET` | 🟢 Emerald Green | Outstanding rate health. You are outpacing your target value. |
| $-10\% \le \text{Variance} < +15\%$ | `NEAR_TARGET` | 🔵 Slate Blue | On track. Realized value matches target expectations. |
| $-30\% \le \text{Variance} < -10\%$ | `BELOW_TARGET` | 🟡 Amber Yellow | Warning. Non-billable overhead or scope creep is diluting hourly yield. |
| $\text{Variance} < -30\%$ | `CRITICAL_UNDERVALUED`| 🔴 Crimson Red | Critical undervaluation. Immediate pricing renegotiation or scope reduction recommended. |

---

## 3. Revenue Metrics: Earned vs Collected

Wello explicitly isolates cash-in-hand collected income from accrued earned revenue:

1. **Gross Earned Revenue ($Y_{\text{earned}}$)**:
   $$Y_{\text{earned}} = \sum \text{Invoiced Amounts} + \sum \text{Unbilled Logged Work}$$
2. **Gross Collected Revenue ($Y_{\text{collected}}$)**:
   $$Y_{\text{collected}} = \sum \text{Settled Client Payments}$$
3. **Outstanding / Overdue Revenue ($Y_{\text{uncollected}}$)**:
   $$Y_{\text{uncollected}} = \sum_{\text{status}=\text{SENT}} \text{Invoice Balance} + \sum_{\text{status}=\text{OVERDUE}} \text{Invoice Balance}$$

---

## 4. Multi-Project Blended Rate

When a user works across multiple clients or project categories, Wello calculates the weighted blended average hourly rate:

$$R_{\text{blended}} = \frac{\sum_{i=1}^{n} (R_{\text{project}, i} \times H_i)}{\sum_{i=1}^{n} H_i} = \frac{\sum_{i=1}^{n} Y_i}{\sum_{i=1}^{n} H_i}$$

---

## 5. Time Tracking & Duration Math

### Active Session Duration with Pause Deductions
$$\text{Duration (seconds)} = (T_{\text{stop}} - T_{\text{start}}) - \sum_{j=1}^{m} (P_{\text{end}, j} - P_{\text{start}, j})$$

Where:
- $T_{\text{start}}, T_{\text{stop}}$: Unix epoch timestamps of timer initiation and completion.
- $P_{\text{start}, j}, P_{\text{end}, j}$: Unix epoch timestamps of pause intervals during the session.

### Time Tracking Edge Cases
- **Active Ongoing Timer**: Duration is computed dynamically against server time: $(T_{\text{server}} - T_{\text{start}}) - \text{Total Pauses}$.
- **Overlapping Sessions**: Backend strictly blocks starting a new session while an active session has `end_time = NULL`.
- **Negative Duration Protection**: If total pause durations exceed elapsed time, duration is clamped to `0`.

---

## 6. Foreign Exchange (FX) & Cross-Rate Triangulation

Wello supports multi-currency project tracking and invoicing with USD as the canonical base anchor:

### Cross-Rate Formula
For converting an amount $A$ in currency $C_{\text{source}}$ to currency $C_{\text{target}}$:

$$\text{Converted Amount} = A \times \frac{\text{Rate}(C_{\text{target}} \text{ per USD})}{\text{Rate}(C_{\text{source}} \text{ per USD})}$$

### Example
Converting 100 EUR to GBP with rates $\text{EUR/USD} = 0.92$ and $\text{GBP/USD} = 0.79$:
$$\text{Amount (GBP)} = 100 \times \frac{0.79}{0.92} = 85.87 \text{ GBP}$$

---

## 7. Tax Calculation Engine

### A. Exclusive Tax (VAT / GST added to subtotal)
$$\text{Tax Amount} = \text{Subtotal} \times \frac{T_{\text{rate}}}{100}$$
$$\text{Total Invoice Amount} = \text{Subtotal} + \text{Tax Amount}$$

### B. Inclusive Tax (Tax embedded within gross total)
$$\text{Net Subtotal} = \frac{\text{Gross Total}}{1 + \frac{T_{\text{rate}}}{100}}$$
$$\text{Embedded Tax Amount} = \text{Gross Total} - \text{Net Subtotal}$$

### C. Reverse Charge Mechanism (Cross-Border B2B)
When the client is a registered VAT entity in another jurisdiction:
$$\text{Tax Rate} = 0\%$$
$$\text{Tax Amount} = 0.00$$
$$\text{Invoice Note} = \text{"Reverse Charge: VAT to be accounted for by the recipient under Art. 194 of Directive 2006/112/EC"}$$

---

## 8. Rolling Time Windows

Metrics summaries are aggregated over rolling UTC calendar intervals:

| Window Key | Period Interval | Formula |
| :--- | :--- | :--- |
| `7d` | Past 7 days | $T \ge \text{now}() - 7 \text{ days}$ |
| `30d` | Past 30 days | $T \ge \text{now}() - 30 \text{ days}$ |
| `90d` | Past 90 days (Quarter) | $T \ge \text{now}() - 90 \text{ days}$ |
| `365d` | Past 365 days (Annual) | $T \ge \text{now}() - 365 \text{ days}$ |
| `all` | Lifetime Account History| All records where `deleted_at IS NULL` |

---

## 9. Mathematical Edge Cases & Defenses

| Edge Case Scenario | Mathematical Threat | Wello Engine Defense |
| :--- | :--- | :--- |
| **Zero Hours Worked** ($H = 0$) | Division by Zero ($\frac{Y}{0}$) | Clamps $R_{\text{effective}}$ to `0.00` without throwing mathematical exceptions. |
| **Zero Income Collected** ($Y = 0$) | Negative rate if expenses exist | Computes negative net yield or `0.00`, flagging status as `CRITICAL_UNDERVALUED`. |
| **Direct Expenses Exceed Revenue** | Net loss ($E_{\text{direct}} > Y$) | Reflects actual negative net hourly rate (e.g. $-\$15.50/\text{hr}$) to alert user to unprofitable projects. |
| **Multi-Tax Rate Invoices** | Compounding tax errors | Calculates each line item's tax individually with decimal precision (`DECIMAL(12,2)`) before summation. |
