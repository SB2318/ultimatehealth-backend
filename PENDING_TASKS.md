# 📋 Pending Tasks (Target: Today)

This document tracks priority tasks to be completed today for UltimateHealth Backend.

---

### Task List

- [x] **1. Related Articles** *(Completed)*
  - Recommendation and query algorithm for linking related articles based on category, tags, and content similarity.
  - Compound ESR index `{ status: 1, is_removed: 1, language: 1, tags: 1 }` and text index.
  - Hybrid scoring pipeline (tag overlap count + text score + logarithmic engagement boost).
  - Validation schemas (Zod params & query) and endpoint `GET /api/articles/:id/related`.

- [x] **2. Glossary Data Upload** *(Completed)*
  - Bulk ingestion pipeline for medical glossary terms and definitions.
  - Successfully seeded 379 unique medical terms with zero duplication across 18 medical categories.
  - Multi-language support: English (355), Hindi (15), Bengali (9).
  - Automatically mapped & created missing `ArticleTag` category relations.

- [ ] **3. Contributor Data Upload**
  - Processing and seeding contributor profiles and credentials into the platform.

- [x] **4. Send Message Portion** *(Completed)*
  - Messaging and communication module implementation with safe sender display and `replyTo` direct routing.
  - Full OpenAPI documentation added.

- [x] **5. Glossary Review System** *(Completed)*
  - Moderator / Admin workflow to inspect, approve, edit, or reject submitted glossary terms.
  - Direct MongoDB text document review lifecycle (without PocketBase dependency).
  - Added `language` field and weighted text + ESR compound indexes for instant searching.
  - Full admin queue endpoints (`review-queue`, `my-reviews`, `pick`, `approve`, `feedback`, `reject`).

- [x] **6. Superadmin-Specific Admin Applicant Display** *(Completed)*
  - Protected API and dashboard view restricted to Super Admin (`isSuperAdmin: true`) to list, view resumes, and review `AdminApplicant` submissions.
  - Created `superAdminMiddleware.js` and registered paginated applicant management routes.

---
