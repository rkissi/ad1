# Production Readiness Audit Report

**Date:** March 2025
**Auditor:** Jules (AI Senior Staff Engineer)
**Target:** Metaverse Advertising Platform (MVP)

---

## 1. Executive Summary

The Metaverse Advertising Platform is currently in a **mixed architectural state** that renders it **unsafe for production**. While the Frontend and Onboarding flows have correctly adopted the target "Supabase Native" architecture (Supabase Auth, RLS, `public.profiles`), the core Backend services (Campaigns, Events, Marketplace, Payments) are running on a legacy, custom Node.js/PostgreSQL architecture (`src/lib/database.ts`) that is disconnected from the authenticated user base.

This "Split-Brain" architecture is the primary blocker. Users authenticated via Supabase cannot securely or effectively interact with backend services that expect legacy user records.

**Production Readiness Score:** 35/100
**Verdict:** 🔴 **NOT SAFE TO DEPLOY**

---

## 2. Critical Production Blockers (Must Fix)

1.  **Identity System Split:**
    *   Frontend uses Supabase Auth (UUIDs).
    *   Backend uses custom `users` table with `did` as primary key and password hashes.
    *   **Impact:** Authenticated users cannot create campaigns or track events because the backend does not recognize their Supabase UUIDs.

2.  **Legacy Database Logic:**
    *   `src/lib/database.ts` manages a separate schema (`users`, `campaigns`, etc.) using a direct `pg` connection, bypassing Supabase RLS policies.
    *   **Impact:** Security vulnerability. Backend logic is not enforcing Row Level Security defined in Supabase.

3.  **Insecure Smart Contract Identity:**
    *   `src/lib/smart-contracts.ts` generates deterministic Ethereum private keys from DIDs (`didToPrivateKey`).
    *   **Impact:** **CRITICAL SECURITY FLAW.** Anyone who knows a user's DID (which is public) can derive their private key and steal funds.

---

## 3. Security Risks

*   **🔴 Deterministic Wallet Generation:** As noted above, `ContractUtils.didToPrivateKey` is a catastrophic security risk.
*   **🟠 Missing RLS Enforcement:** The Node.js backend connects as a privileged user (likely `postgres` or `service_role` equivalent) via `DatabaseService` and manually handles logic, bypassing the robust RLS policies defined in `supabase/migrations/01_schema.sql`.
*   **🟡 Environment Variable Fallbacks:** Backend services (e.g., `SmartContractService`) use `import.meta.env` (Vite/Frontend) fallbacks. If deployed in a standard Node environment without these specific build-time replacements, secrets may be missing or default to insecure test values (e.g., default private keys).

---

## 4. Architecture Weaknesses

*   **Frontend-Backend Coupling:** The codebase mixes frontend utilities (e.g., `src/lib/payment-service.ts` using `localStorage`) with backend logic.
*   **Duplicate Logic:** "Supabase Native" logic exists in `src/lib/supabase-database.ts` but is unused by the main server, which uses `src/lib/database.ts`.
*   **State Management:** Transaction state is managed in a custom `blockchain_transactions` table instead of being integrated into the Supabase flow.

---

## 5. Frontend Audit

*   **Auth Flow:** Correctly uses `auth-context.tsx` and Supabase.
*   **API Usage:** `api-client.ts` correctly attaches the Supabase JWT.
*   **Issues:**
    *   The frontend likely breaks when trying to access Campaign/Marketplace features because the backend expects the legacy Auth context.
    *   Payment integration (`payment-service.ts`) relies on `auth_token` in `localStorage`, whereas Supabase stores tokens differently.

---

## 6. Backend / API Audit

*   **Auth:** Legacy `/auth/*` endpoints were present (now disabled/deprecated).
*   **Middleware:** I have added `requireAuth` to enforce Supabase JWTs, but the *downstream* logic in controllers (e.g., `db.createCampaign`) still expects the legacy schema.
*   **Admin Routes:** `src/api/admin-routes.ts` blindly trusts the `DatabaseService` and lacks proper Supabase Role checks (it checks a header string manually).

---

## 7. Database / Supabase Audit

*   **Schema:** `supabase/migrations/01_schema.sql` is well-structured and contains the correct tables (`profiles`, `campaigns`, `events`) with RLS policies.
*   **Reality:** The backend is **ignoring** this schema and creating/using its own parallel tables via `src/lib/database.ts` (`createTables` method).
*   **Data Integrity:** There is zero synchronization between `public.profiles` (Supabase) and `public.users` (Legacy).

---

## 8. Onboarding Flow Audit

*   **Status:** 🟢 **Safe**.
*   The onboarding flow (`src/api/onboarding-routes.ts`) is the *one* part of the backend that correctly uses `supabase-server.ts` and interacts with the `public.profiles` table. This is the model the rest of the backend must follow.

---

## 9. Stripe / Payments Audit

*   **Implementation:** `src/lib/payment-service.ts` is a client-side wrapper.
*   **Backend:** `src/api/payment-routes.ts` uses `process.env.STRIPE_SECRET_KEY` but has a hardcoded placeholder fallback `sk_test_placeholder...` which will crash or fail in production if not set.
*   **Risk:** Webhook handling (`/webhook`) logs success/fail but does not appear to update the database state (e.g., funding a campaign) in the Supabase schema.

---

## 10. Performance & Scalability

*   **Redis:** `EventTracker` uses Redis for buffering, which is good for scale.
*   **Connection Pooling:** The legacy `DatabaseService` uses `pg.Pool`, which is fine, but Supabase's built-in connection pooler (Supavisor) should be used instead.
*   **N+1 Issues:** The legacy `getCampaigns` logic does simple selects. Supabase PostgREST is generally more optimized for these standard fetches.

---

## 11. Demo / Dev Code Found

*   **Mock Data:** `EventTracker` has `getMockCampaignMetrics` methods used when Redis is offline. This poses a risk if the production environment misconfigures Redis, leading to fake data being shown to users.
*   **Hardcoded Secrets:** Default private keys in `SmartContractService`.
*   **Legacy Routes:** `/auth/register` and `/auth/login` (Now deprecated).

---

## 12. Data Consistency Risks

*   **High Risk:** A user can be "Onboarded" (in `profiles` table) but "Invisible" to the Campaign system (which looks at `users` table).
*   **Blockchain Sync:** `TransactionManager` records state in a local table (`blockchain_transactions`) which may drift from the actual blockchain state if the service crashes.

---

## 13. Exact Fix Recommendations

### Phase 1: Unification (Immediate)
1.  **Refactor Server:** Replace `src/lib/database.ts` usage in `server.ts` with `src/lib/supabase-database.ts` (or direct Supabase Client calls).
2.  **Fix Identity:** Update all backend controllers to use `req.user.id` (Supabase UUID) instead of `did` or `email` lookup from the legacy table.
3.  **Drop Legacy:** Delete `src/lib/database.ts` and the `users` table logic entirely.

### Phase 2: Security (Critical)
4.  **Wallet Connect:** Remove `ContractUtils.didToPrivateKey`. Implement "Connect Wallet" on the frontend (e.g., via RainbowKit/Wagmi) and have users sign messages to prove ownership. Store the *public address* in `profiles.wallet_address`.
5.  **Admin:** Rewrite `admin-routes.ts` to use `supabase.auth.admin` methods and check `profiles.role`.

### Phase 3: Reliability
6.  **Stripe:** Connect Stripe Webhooks to the `transactions` table in Supabase.
7.  **Environment:** Remove all default/fallback secrets. Fail fast if secrets are missing.

---

## 14. Verdict

**Safe To Deploy?** **NO**

**Next Steps:**
1.  Approve the plan to refactor `src/api/server.ts` to use Supabase Native services.
2.  Approve the removal of `src/lib/database.ts`.
3.  Authorize the integration of real Web3 wallet connection logic to replace the insecure key generation.
