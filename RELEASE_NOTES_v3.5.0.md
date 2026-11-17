# 🚀 Release Notes — UltimateHealth Backend v3.5.0

**Date:** November 17, 2026  
**Package Version:** `1.7.1`  
**Swagger API Specification Version:** `3.5.0`  
**Milestone:** Enterprise Security Hardening, Zero Hardcoded Secrets, Granular Rate Limiting, Perimeter Network Isolation & HIPAA Audit Integrity  

---

## 🛡️ Highlights & Major Security Hardening

This release represents a comprehensive security overhaul of the UltimateHealth backend across 13 security dimensions, eliminating hardcoded fallback secrets, securing unauthenticated entry points, mitigating BOLA vulnerabilities, isolating internal container services, and establishing production-grade rate limiting.

---

### 1. 🔑 Elimination of Hardcoded Fallback Secrets
- **Zero Insecure Fallbacks (`services/security/tokenService.js`):**
  - Removed all hardcoded string secrets (`"fallback_access_secret"`, `"fallback_refresh_secret"`, `"fallback_verification_secret"`, `"fallback_secret"`, `"fallback_default_secret_key_123"`).
  - The service now validates all required cryptographic keys at startup and halts execution with a fatal error if any signing secret is missing.
- **Publisher Guard Hardening (`middleware/publisherMiddleware.js` & `exportContributors.js`):**
  - Removed hardcoded fallback literal `"sb2318@ultimatehealth_refresh"`. Both middleware and export scripts strictly mandate `process.env.JWT_REFRESH_SECRET`.
- **Database Fallback Isolation (`config/database.js`):**
  - Eliminated silent fallback to an unauthenticated local MongoDB instance in production mode. If `MONGODB_URL` is unreachable in production, the backend terminates immediately rather than saving production data into an unprotected local store.
- **Legacy Middleware Deprecation (`middleware/authMiddleware.js`):**
  - Refactored legacy middleware to delegate token validation to `tokenService.js` (`verifyAnyToken`), retiring reliance on legacy weak HS256 secret verification.

---

### 2. ⚡ Tailored Rate Limiting Suite (`middleware/ratelimit.js`)
Implemented granular, role-aligned throttling to prevent brute-force attacks, scraping, and service degradation without affecting legitimate readers or mobile app workflows:

| Limiter | Window | Quota | Key Strategy | Target Endpoints & Purpose |
|---|:---:|:---:|:---:|---|
| **`contactLimiter`** | 15 min | 5 req | IP | `POST /contact` — Prevents SMTP mail bombing on public contact forms. |
| **`newsletterLimiter`** | 1 hour | 10 req | IP | `POST /newsletter/subscribe` — Blocks automated database bloat. |
| **`searchLimiter`** | 1 min | 60 req | User / IP | `GET /articles/search` — Supports smooth client-side typing debouncing while blocking scrapers. |
| **`uploadLimiter`** | 10 min | 15 req | User / IP | `POST /upload-storage` & `POST /admin/upload-agreement` — Protects disk and S3 quotas. |
| **`resendOtpLimiter`** | 10 min | 3 req | IP | `POST /user/resend-verification-mail` & `/admin/resend-verification-mail` — Throttles email dispatch abuse. |
| **`mutationLimiter`** | 5 min | 30 req | User / IP | `POST /user/follow`, `/articles/likeArticle`, `/articles/saveArticle`, `/article/repost`, `/report/submit`, `/care-team/break-glass` — Throttles high-frequency write actions. |
| **`heavyOperationLimiter`** | 30 min | 5 req | User | `GET /wellness/export` & `GET /gemini/export` — Prevents CPU exhaustion during bulk health data exports. |
| **`loginLimiter`** | 15 min | 5 req | IP | `POST /user/login`, `/user/google-auth`, `/admin/login` — Enforces 700ms minimum duration to counter timing attacks and brute-forcing. |

---

### 3. 🔐 Access Control & BOLA Elimination
- **Authenticated S3 File Uploads (`routes/uploadRoute.js`):**
  - Added `authenticateToken` middleware and `uploadLimiter` to `POST /upload-storage`. Anonymous uploads to S3 are blocked.
- **Administrative Account Deletion (`routes/usersRoutes.js`):**
  - Added `adminAuthenticateToken` to `POST /admin/deleteUser`. Unauthenticated callers or standard users are rejected.
- **Admin Password Update Guardrails (`routes/adminAuthRoute.js` & `controllers/admin/adminAuthController.js`):**
  - Added `adminAuthenticateToken` and `mutationLimiter` to `POST /admin/update-password`.
  - Added account ownership verification ensuring admins can only update their own account credentials (`req.userId === user._id`).
- **Article Review Revision BOLA Restored (`controllers/admin/articleReviewController.js`):**
  - Restored and enforced author ownership verification in `submitSuggestedChanges` (`article.authorId === userId`).
- **User Analytics BOLA Closed (`controllers/analyticsController.js`):**
  - Enforced `req.userId === req.params.userId` across `getTotalReadCountOfUser`, `getTotalWriteCountOfUser`, and `getTotalLikeAndViewReceivedByUser`.

---

### 4. 🌐 Real-Time WebSockets & Audit Integrity
- **WebSocket Handshake Authentication (`index.js`):**
  - Enforced token validation in `io.use` using `verifyAnyToken`.
- **Private Notification Room Isolation (`index.js`):**
  - `join-user-notifications` strictly enforces authentication and forces the room name to `user:${socket.userId}`, completely preventing unauthorized users from eavesdropping on foreign notification streams.
- **HIPAA Audit Log IP Spoofing Prevention (`middleware/hipaaAudit.js`):**
  - Refactored `getClientIp` to prioritize Express `req.ip` adhering to `trust proxy 1` configuration, preventing client-injected spoofed `X-Forwarded-For` headers from tampering with HIPAA audit logs (§ 164.312(b)).
- **S3 Download Path Traversal Sanitization (`controllers/uploadController.js`):**
  - Added directory traversal sanitization in `getFile` rejecting keys with `..`, `\`, or leading `/`.

---

### 5. 🏗️ Infrastructure & Express Pipeline Hardening
- **Container Loopback Binding (`docker-compose.yml`):**
  - Internal service ports for MongoDB (`27017`), Redis (`6379`), PocketBase (`8090`), and Kafka (`9092`) are now strictly bound to `127.0.0.1` rather than `0.0.0.0`.
- **Request Body Limits (`index.js`):**
  - Reduced Express JSON and urlencoded body parser limits from 50MB to 2MB (configurable via `process.env.REQUEST_BODY_LIMIT`).
- **Production Stack Trace Masking (`middleware/errorHandler.js`):**
  - Fixed case-sensitivity bug (`.toLowerCase() === "production"`), ensuring internal stack traces are masked in production responses.
- **Swagger Documentation Gating (`index.js`):**
  - Gated `/api/docs` and `/docs` to return HTTP 404 in production unless explicitly enabled via `ENABLE_SWAGGER=true`.
- **Cleaned Diagnostic Endpoints (`index.js` & `routes/usersRoutes.js`):**
  - Removed lingering `/hello` test routes.
- **Sanitized Logging (`controllers/usersControllers.js`):**
  - Purged console logging of full user objects, hashed refresh tokens, and request headers.

---

## 📋 Updated Specifications
- **`package.json`:** `1.7.1`
- **`swagger.js`:** OpenAPI `3.5.0`
- **Documentation:** All 8 comprehensive security audit reports updated in `.gitignore` local storage.
