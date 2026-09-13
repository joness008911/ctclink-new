# CleanTraffic Roadmap & Implementation Plan: Tiered Detection Engine

## Overview
This document outlines the architecture and execution plan to separate CleanTraffic's detection capabilities into two distinct pricing tiers:
- **Basic / Core Detection ($50/month)**: Server-side edge protection (sub-millisecond direct evaluation).
- **Max / Deep Detection ($90/month)**: Full multi-layer detection including client-side biometrics, browser DOM verification, and GPU hardware integrity.

---

## 1. Feature Matrix by Plan Tier

| Capability | Basic Detection ($50/mo) | Max Detection ($90/mo) |
| :--- | :---: | :---: |
| **Engine Architecture** | Server-Side Fast Gateway | Multi-Layer Engine (Server + Behavioral DOM) |
| **IP Intelligence & ASN** | IP2Location & IP2Proxy | IP2Location & IP2Proxy |
| **Datacenter & Cloud Host Filter** | Included | Included |
| **Known Bots & Crawler Signatures** | 120+ Regex Signatures | 120+ Regex Signatures |
| **HTTP Header Anomaly Detection** | Included | Included |
| **Geo-fencing & Device Routing** | Included | Included |
| **Velocity & Rate-Limiting Filter** | Included | Included |
| **Canvas & WebGL GPU Verification** | — | **Included** |
| **Headless Framework Traps (Puppeteer/Playwright)** | Pattern matching only | **Active DOM & Runtime Traps** |
| **Biometric Telemetry (Mouse/Scroll/Touch)** | — | **Included** |
| **DevTools Open Detection** | — | **Included** |
| **Evaluation Mode Support** | Fast 302 Redirect | Fast 302 Redirect OR Self-Contained Interstitial |

---

## 2. Technical Architecture & Component Changes

### Phase 1: Shared Schema & Billing Definitions
- [ ] **`shared/subscription.ts` & `shared/schema.ts`**:
  - Define tier constants:
    - `BASIC_TIER`: `$50/mo`, `tierCode: "basic_detection"`
    - `MAX_TIER`: `$90/mo`, `tierCode: "max_detection"`
  - Add feature entitlements helper:
    ```typescript
    export function hasDeepInspection(tier: string): boolean {
      return tier === "max_detection" || tier === "enterprise";
    }
    ```
  - Ensure database migrations and Stripe/billing webhook handlers map to the new tiers.

### Phase 2: Server-Side API (`server/routes.ts`)
- [ ] **`/api/classify` Endpoint**:
  - Check account owner's active subscription tier via API key.
  - Return entitlement flag in the classification response:
    ```json
    {
      "visitorType": "Human",
      "targetUrl": "https://...",
      "tier": "max_detection",
      "features": {
        "canDeepInspect": true,
        "sessionToken": "signed_token_here"
      }
    }
    ```
- [ ] **`/api/telemetry` Endpoint (New)**:
  - Create dedicated endpoint to receive client-side biometric and hardware payloads.
  - Use non-blocking processing so telemetry ingestion never affects server load.
  - Update visitor log in database to attach behavioral integrity scores.

### Phase 3: PHP Protection Package (`client/public/CleanTraffic-PHP-Protection-Package.tar.gz`)
- [ ] **Option A: Self-Contained Interstitial Challenge (Inside PHP)**:
  - When account tier is `max_detection` and user enables "Deep Inspection" in settings:
    - If request is suspicious or requires verification, render a lightweight, branded micro-screen (< 300ms).
    - Run inline hardware checks:
      - `navigator.webdriver` check
      - Offscreen WebGL GPU driver rendering check (SwiftShader / Mesa vs real GPU)
      - Micro-interaction listener (accelerometer, pointer movement)
    - On verification, set a secure session cookie (`$_SESSION['ct_verified'] = true`) and complete redirect.
  - When account tier is `basic_detection` (or Deep Inspection is disabled):
    - Run instant sub-millisecond 302 redirect.
- [ ] **Option B: Standalone Client Script (`ct.js`)**:
  - Include an optional `<script src=".../ct.js">` tag for users who want continuous in-page monitoring on their final destination or conversion forms.

### Phase 4: User Dashboard Experience (`client/src/pages/user-dashboard.tsx`)
- [ ] **Integration Tab**:
  - Add a **Detection Mode Switcher**:
    - "Fast Gateway (Sub-ms Redirect)" — Available on all plans.
    - "Deep Behavioral & GPU Verification" — Enabled for Max Detection ($90/mo), shows upgrade banner for Basic ($50/mo).
- [ ] **Live Logs Table**:
  - For Max tier users, display behavioral signal badges (e.g. *Organic Biometrics*, *GPU Hardware Authentic*, *DevTools Inactive*).
- [ ] **Billing / Subscription Tab**:
  - Allow seamless upgrading between $50 and $90 tiers with clear feature differentiators.

### Phase 5: Landing Page & Documentation
- [ ] **Pricing Section (`client/src/pages/landing.tsx`)**:
  - Update plan cards to highlight the $50 Basic Detection vs $90 Max Detection plans.
  - Update the feature comparison table to accurately detail which detection layers belong to which tier.
- [ ] **Documentation (`client/src/pages/documentation.tsx`)**:
  - Add a guide explaining the difference between Fast Edge Evaluation and Deep Behavioral Inspection.

---

## 3. Implementation Safety Rules
1. **Never break existing deployments**: Old versions of the PHP package must continue to work via standard `/api/classify` without requiring urgent code changes.
2. **Fail-open fallback**: If behavioral checks fail to load due to client-side ad-blockers, the server-side decision made by PHP acts as the primary safety net.
3. **Sub-millisecond priority**: Never introduce blocking network calls into the fast redirect path.
