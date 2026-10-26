# 🚀 Release Notes — UltimateHealth Backend v3.5.0
**Date:** October 26, 2026  
**Package Version:** `1.7.0`  
**Swagger API Specification Version:** `3.5.0`  
**Milestone:** Super Admin Console Overhaul, 7-Day Session Token Support, Staff Dossier & Platform Analytics

---

## 🌟 Highlights & New Features

### 1. 🔑 7-Day Session Token & Unified Token Verification Service
- **Dual Token Validation (`services/security/tokenService.js`):**
  - Added `verifyAnyToken(token)` service that dynamically inspects token payloads and verifies both **15-minute short-lived access tokens** and **7-day long-lived session/refresh tokens**.
  - Enforces cryptographic verification (`RS256` / `HS256`), token expiration, Redis revocation (`blacklist:<jti>`), and session version validation.
- **Enhanced Token Status Check (`controllers/usersControllers.js`):**
  - Route: `GET` & `POST /api/checkTokenStatus`
  - Aliases: `/api/admin/checkTokenStatus`, `/api/admin/tokenstatus`, `/api/tokenstatus`
  - Extracts token from `Authorization: Bearer <token>`, cookies (`accessToken`, `refreshToken`), query (`?token=`), or JSON body.
  - Returns structured user profile, role, `isSuperAdmin`, `tokenType` (`access` | `refresh`), and ISO `expiresAt` timestamp.

---

### 2. 🛡️ Staff Directory & Profile Dossier Endpoints (`v3.5.0`)
- **Admin Status & Suspension Management:**
  - Routes:
    - `PUT /api/admin/:id/status` & `PATCH /api/admin/:id/status`
    - `PUT /api/admin/admins/:id/status` & `PATCH /api/admin/admins/:id/status`
    - `PUT /api/admin/admins/:id/block` & `PATCH /api/admin/admins/:id/block`
  - Request Body:
    ```json
    {
      "is_blocked": true,
      "status": "suspended"
    }
    ```
  - Allows Super Admins to suspend (`isBlocked: true`) or reinstate (`isBlocked: false`) admin accounts.
  - Guardrails: Self-blocking and blocking other Super Admins are strictly disallowed (`400`/`403`).
- **Staff Profile Dossier by ID:**
  - Routes: `GET /api/admin/profile/:id`, `GET /api/admin/admins/:id`, `GET /api/admin/:id`
  - Returns complete enterprise profile including:
    - Identity, role, `@user_handle`, status (`active` | `suspended`), verified signature URL.
    - Assigned Permissions Matrix (`canReviewArticles`, `canInspectDiffs`, `canManageReports`, `canManageGlossary`, `canAuditGlobal`).
    - Lifetime Contribution Metrics (`articlesReviewed`, `improvementsReviewed`, `reportsHandled`).

---

### 3. 📊 Super Admin Platform Analytics (Executive Console KPIs)
- **Routes:** `GET /api/admin/platform-analytics`, `GET /api/admin/analytics/overview`
- **Access:** Super Admin only (`adminAuthenticateToken` + `requireSuperAdmin`)
- **Metrics Breakdown:**
  - **Staff Metrics:** `totalAdmins`, `activeAdmins`, `suspendedAdmins`, `pendingApplicants`, `totalApplicants`
  - **Content Metrics:** `unassignedArticles`, `inProgressArticles`, `publishedArticles`, `totalArticles`, `reviewQueueCount`
  - **Moderation Metrics:** `pendingReports`, `resolvedReports`, `totalReports`
  - **Master Data Metrics:** `totalSpecializations`, `totalLanguages`

---

### 4. 🚩 Abuse Reasons with Content Breakdown Metrics
- **Routes:** `GET /api/report/reasons/metrics`
- **Access:** Authenticated Admins / Super Admins
- **Enriched Reason Breakdown:**
  - For each moderation rule/reason, aggregates real-time counts:
    - `activeReportsCount` (Pending + In-Investigation)
    - `resolvedReportsCount` (Resolved / Action Taken)
    - `totalReportsCount`

---

### 5. 🏥 Comprehensive Master Data Seeder (`scripts/seedAdminMasterData.js`)
- **Idempotent Data Seeder:**
  - Run command: `npm run seed:admin` or `node scripts/seedAdminMasterData.js`
  - Uses atomic upserts (`findOneAndUpdate` with `$set` and `$setOnInsert`) to prevent duplication.
- **Pre-loaded Master Data Collections:**
  - **4 Mock Admins / Moderators:**
    - Super Admin: `sb2318@it.jgec.ac.in` (`SuperAdmin@123`)
    - Moderator (Cardiology Lead): `dr_ananya@ultimatehealth.org` (`Moderator@123`)
    - Moderator (Neurology Lead): `dr_rajesh@ultimatehealth.org` (`Moderator@123`)
    - Content Reviewer: `reviewer@ultimatehealth.org` (`Reviewer@123`)
  - **15 Medical Specializations:** Cardiology, Neurology, Endocrinology, Dermatology, Pediatrics, Orthopedics, Oncology, Psychiatry, Gastroenterology, Pulmonology, Ophthalmology, Gynecology, Nephrology, Rheumatology, Internal Medicine.
  - **8 System Languages:** English (`en-IN`), US English (`en-US`), Hindi (`hi-IN`), Bengali (`bn-IN`), Tamil (`ta-IN`), Telugu (`te-IN`), Marathi (`mr-IN`), Spanish (`es-ES`).
  - **12 Content Cluster Tags:** IDs 1 to 12.
  - **7 Moderation Reasons:** Disinformation, Dosage Safety, Plagiarism, Spam, Hate Speech, Privacy Violations, Outdated Guidance.
  - **5 Reviewer Applicants:** Across `pending`, `reviewed`, `approved`, `rejected` with resumes and agreements.
  - **4 Articles Across Review Queues:** `unassigned`, `in-progress`, `review-pending`, `published`.
  - **2 Article Improvement Requests:** `unassigned`, `in-progress`.
  - **2 Content Abuse Reports:** `Pending`, `Investigation Start`.

---

### 6. 🔌 Multi-Cluster & Local MongoDB Resilience
- **Database Fallback Engine (`config/database.js`):**
  - Seamlessly handles primary cloud cluster (`process.env.MONGODB_URL`) with an automatic fallback to local MongoDB (`mongodb://127.0.0.1:27017/ultimate_health`) when network/IP access restricts Atlas connections.
  - Guards Redis session checks with try-catch fallbacks in `controllers/admin/adminAuthController.js`.

---

## 📋 New & Enhanced API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET/POST` | `/api/checkTokenStatus` | Verify access or 7-day session token | Public / Bearer |
| `GET/POST` | `/api/admin/checkTokenStatus` | Admin alias for token verification | Public / Bearer |
| `PUT/PATCH`| `/api/admin/:id/status` | Update admin account status (block / unblock) | Super Admin |
| `PUT/PATCH`| `/api/admin/admins/:id/status` | Alias for admin status toggle | Super Admin |
| `GET` | `/api/admin/profile/:id` | Get admin profile dossier, permissions & metrics | Super Admin |
| `GET` | `/api/admin/platform-analytics` | Platform KPI overview for executive console | Super Admin |
| `GET` | `/api/report/reasons/metrics` | Abuse reasons list with live report metrics | Admin / Super Admin |
