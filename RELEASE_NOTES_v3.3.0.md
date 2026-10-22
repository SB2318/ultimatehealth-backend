# 🚀 Release Notes — UltimateHealth Backend v3.3.0
**Date:** October 22, 2026  
**Target Milestone:** Today's Core Backend Enhancements & Security Polish

---

## 🌟 Highlights & New Features

### 1. 📚 Related Articles Recommendation Engine (`v3.3.0`)
- **Compound ESR Index:** Added `{ status: 1, is_removed: 1, language: 1, tags: 1 }` and full-text index on `title`, `description`, and `content`.
- **Hybrid Scoring Algorithm:** Combines:
  - Multikey tag intersection overlap (50% weight)
  - Text relevance score via `$meta: "textScore"` (35% weight)
  - Logarithmic popularity boost from views and likes: `ln(views + 2*likes + 1)` (15% weight)
  - Graceful fallback to trending published articles when candidate matches are fewer than requested limit.
- **New Public Endpoint:** `GET /api/articles/:id/related?limit=5&excludeIds=10,12` with Zod parameter & query sanitization.

### 2. 📖 Medical Glossary Review System & Multi-Language Search
- **Direct Mongo Document Review Workflow:** Full moderation lifecycle (Unassigned $\to$ In-Progress $\to$ Published / Discarded / Awaiting-User) without external PocketBase file overhead.
- **Review Queues:** 
  - `GET /api/glossary/admin/review-queue`
  - `GET /api/glossary/admin/my-reviews/in-progress`
  - `GET /api/glossary/admin/my-reviews/completed`
  - Actions: `pick`, `approve`, `feedback`, `reject`.
- **Compound & Weighted Text Indexes:** Added `GlossaryTextSearchIndex` with field weights (`term: 10`, `synonyms: 5`, `shortDescription: 2`, `definition: 1`) and ESR index `{ language: 1, status: 1, is_removed: 1, term: 1 }`.
- **Language Support:** Added indexed `language` field (`default: 'en-IN'`).

### 3. 🛡️ Superadmin-Specific Admin Applicant Display
- **Role Isolation:** Introduced `middleware/superAdminMiddleware.js` enforcing `isSuperAdmin: true`.
- **Applicant Management API:**
  - `GET /api/admin/applicants` (paginated, filtered by `status`, `role`, and `search`).
  - `GET /api/admin/applicants/:id` (detailed view with direct S3 resume link).
  - `PUT /api/admin/applicants/:id/status` (approve, reject, or mark under review with remarks).

### 4. ✉️ Messaging & Contact Us Email Routing
- **Anti-Spam / DMARC Compliance:** Configured `sendContactUsMail` to use authenticated domain sending while setting `from: "${name}" <process.env.EMAIL_USER>` and `replyTo: email`.
- **One-Click Reply:** Support team can reply directly to contact submissions in Gmail without hitting SPF/DMARC bounce blocks.

### 5. 🔐 Security & Auth Hardening (Earlier Today)
- Enforced `resetToken` flow for Admin Forgot Password, removing ambiguous OTP verification controller.
- Updated database model & script granting Super Admin role to `sb2318@it.jgec.ac.in`.
- Decoupled `adminApplicant` DB operations into `services/db/applicantService.js`.

---

## 📑 Updated OpenAPI / Swagger Docs (`v3.3.0`)
- Documented all new public and protected endpoints in Swagger specification:
  - `GET /api/articles/{id}/related`
  - `POST /api/contact`
  - `POST /api/admin/apply` & `POST /api/admin-agreement/apply`
  - `GET /api/admin/applicants`, `GET /api/admin/applicants/{id}`, `PUT /api/admin/applicants/{id}/status`
  - `GET /api/glossary`, `GET /api/glossary/search`, `GET /api/glossary/{slug}`

---

## 👥 Contributors (Backend Team)
- **S. B. (@SB2318)** — Lead Developer & Maintainer
- Subhendu (@Subhendu-coder)
- Saptarshi (@Saptarshi312)
- Sayan Ghosh (@iam-sayan-ghosh)
- Subhadip (@Subhadip001)
- Sourav Bapari (@souravbapari)
- Subhadip Maity (@Subhadip-Maity)
- Sayan Chandra (@sayanchandra)
