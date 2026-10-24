# 🚀 Release Notes — UltimateHealth Backend v3.4.0
**Date:** October 24, 2026  
**Package Version:** `1.7.0`  
**Swagger API Specification Version:** `3.4.0`  
**Milestone:** Content Ownership, Data Retention, Storage Security & Super Admin Controls

---

## 🌟 Highlights & New Features

### 1. 🛡️ Content Ownership & Authorization Middleware (`v3.4.0`)
- **Centralized Guard (`middleware/contentOwnershipMiddleware.js`):** Unified ownership validation engine across all core content entities.
- **Enforced Access Matrix:**
  - **Articles (`PUT`, `DELETE /api/articles/:id`):** Restricted strictly to original author (`authorId`) or Super Admin.
  - **Podcasts (`PUT`, `DELETE /api/podcast/...`):** Restricted to original creator (`user_id`), assigned review moderator (`admin_id`), or Super Admin.
  - **Playlists (`PUT`, `DELETE /api/podcast/...playlist`):** Restricted to playlist creator (`user`) or Super Admin.
  - **Podcast Episodes (`PATCH`, `DELETE /api/podcast-episodes/:episodeId`):** Restricted to episode creator (`user_id`) or Super Admin.
  - **Article Improvements (`POST /api/article/submit-improvement`):** Restricted strictly to the assigned contributor (`editRequest.user_id`).
  - **Improvement Review Actions (`submit-review`, `publish`, `discard`):** Restricted strictly to the assigned moderator (`editRequest.reviewer_id`) or Super Admin.
  - **Medical Glossary (`PUT`, `DELETE /api/glossary/:id`):** Restricted to author (`authorId`), assigned reviewer (`reviewerId`), or Super Admin.

---

### 2. 🗄️ Database Retention & Assigned ID Integrity Upon Publication
- **EditRequest Preservation in Database:**
  - **PocketBase (`controllers/uploadController.js`):** Removed automatic record deletion on publication. Edit request records and their historical HTML snapshots are preserved permanently.
  - **MongoDB (`controllers/admin/articleEditRequestController.js`):** Upon publishing, `EditRequest` records are transitioned to status `PUBLISHED` rather than discarded, keeping an audit trail of user contributions.
- **Assigned ID Non-Null Guarantee:**
  - All publication pipelines guarantee that assigned reviewer and admin IDs are never cleared or set to `null`:
    - Articles (`article.reviewer_id`)
    - Improvements (`editRequest.reviewer_id`)
    - Podcasts (`podcast.admin_id`)
    - Glossary terms (`term.reviewerId`)

---

### 3. 👑 Super Admin Management: Admin Block & Delete Controls
- **Admin Schema Expansion (`models/admin/adminModel.js`):** Added `isBlocked: { type: Boolean, default: false }`.
- **System-Wide Blocking Enforcement:**
  - **Token Guard (`middleware/adminAuthenticateToken.js`):** Rejects any blocked admin request immediately with `403 Forbidden`.
  - **Authentication Guard (`controllers/admin/adminAuthController.js`):** Disallows login attempts for blocked admins.
- **New Super Admin Endpoints (`routes/adminApplicantRoute.js`):**
  - `GET /api/admin/admins`: Paginated listing of all admins and moderators with search and status filtering.
  - `PUT /api/admin/admins/:id/block` & `PATCH /api/admin/admins/:id/block`: Toggle or explicitly set block status. Includes guardrails preventing self-blocking and Super Admin blocking.
  - `DELETE /api/admin/admins/:id`: Permanently delete an admin account. Includes guardrails preventing self-deletion and Super Admin deletion.

---

### 4. 🔒 S3 File Access Control & Confidentiality Policies
- **Strict Agreement Privacy:**
  - All admin agreements (`agreements-*` / `*agreement*.pdf`) require authentication (`401` if unauthenticated).
  - Restricted strictly to the **Super Admin** or the **Admin owner** (`admin._id` / `signature_url`). Unauthorized admins receive `403 Forbidden`.
- **Applicant Document Privacy Lifecycle:**
  - **Application Stage (Pending / Under Review):** Freely accessible for verification and applicant review.
  - **Onboarded Stage (Approved / Accepted or Admin Account Created):** Strictly locked down to **Super Admin** and the **Admin themselves** (`authAdmin.email === applicant.email`).
- **Public Media Streaming:**
  - Unauthenticated access remains fully functional for public assets (article images, podcast audio/video streams, user avatars, webp/mp3 files) to ensure frictionless reader/listener experience.
- **Wildcard URL Matching:**
  - Added wildcard key support (`/api/getFile/:key(*)`) to properly resolve nested folder paths in S3 keys (e.g. `applicant-resumes/...`).
- **Hardened Deletion Access:**
  - `DELETE /api/deleteFile/:key(*)`: Restricted to Super Admin (`adminAuthenticateToken, requireSuperAdmin`).
  - `DELETE /api/delete-pocketbase-record/:collectionName/:recordId`: Restricted to Super Admin.
  - `DELETE /api/delete-improvement/:record_id`: Restricted to authenticated Admins.

---

### 5. 🛡️ Secondary Vulnerability Fixes
- **Notification Deletion Ownership (`controllers/notifications/notificationController.js`):**
  - Added user check (`notification.userId === req.userId`) to `DELETE /api/notification/:id` to prevent cross-account notification deletion.
- **Master Language Configuration (`routes/languageRoute.js`):**
  - Guarded `POST /api/language`, `PUT /api/language/:id`, and `DELETE /api/language/:id` with `adminAuthenticateToken, requireSuperAdmin`.

---

## 📑 Updated Specifications & Packages
- **`package.json`:** `1.7.0`
- **`swagger.js`:** OpenAPI `3.4.0` with updated Admin schema (`isSuperAdmin`, `isBlocked`) and new management routes.
