# UltimateHealth Backend — Authentication & Authorization Audit

**Audit Date:** 2026-11-17  
**Scope:** Identity Lifecycle, Token Generation & Verification, Middleware Layers, Role Management, and Access Control  
**Application:** UltimateHealth Backend (`main` @ `6e3392d`)  

---

## 1. Executive Summary: Identity & Access Architecture

UltimateHealth implements a hybrid authentication mechanism consisting of:
- **JWT (JSON Web Tokens)**: Used for stateless API authentication (Access Tokens, Refresh Tokens, Verification Tokens).
- **Dual Verification Modes**: RS256 with HS256 fallbacks implemented in `services/security/tokenService.js`.
- **Legacy Middleware**: Older HS256 middleware (`middleware/authMiddleware.js`) coexisting with newer layers (`middleware/authentcatetoken.js` and `middleware/authenticate.js`).
- **Role Framework**: Roles identified across database schemas include `user`, `doctor`, `admin`, `moderator`, and `superadmin`.

While modern security patterns (e.g., Redis-based token revocation, token rotation, and Zod schema validations) have been introduced in `v2`, significant architectural fragmentation and legacy bypasses introduce critical risks across the system.

---

## 2. Authentication Middleware Architecture Analysis

The codebase currently maintains **four separate authentication middleware implementations**, leading to inconsistent security postures across endpoints:

```
                          ┌──────────────────────────┐
                          │     Incoming Request     │
                          └─────────────┬────────────┘
                                        │
           ┌────────────────────────────┼───────────────────────────┐
           │                            │                           │
           ▼                            ▼                           ▼
┌──────────────────────┐     ┌──────────────────────┐    ┌──────────────────────┐
│  authMiddleware.js   │     │ authentcatetoken.js  │    │   authenticate.js    │
│  (Legacy HS256)      │     │ (Active standard)    │    │   (v2 Redis-backed)  │
└──────────┬───────────┘     └──────────┬───────────┘    └──────────┬───────────┘
           │                            │                           │
           ▼                            ▼                           ▼
Uses weak JWT_SECRET         Uses RS256/HS256 dual       Checks Redis blacklist
Direct env read              Reads cookie or header      Validates tokenVersion
```

### 2.1. Middleware Inventory & Discrepancies

1. **`middleware/authentcatetoken.js` (Standard User Token Middleware)**
   - Extracts Bearer token from `Authorization` header or `accessToken` cookie.
   - Delegates validation to `tokenService.verifyAccessToken(token)`.
   - Attaches `req.userId`, `req.userEmail`, and `req.userRole` to the request.
   - **Weakness:** Does not verify token invalidation against Redis on every request; relies strictly on token expiration.

2. **`middleware/adminAuthenticateToken.js` (Admin Middleware)**
   - Intended to gate `/admin/*` routes.
   - Verifies token signature and checks if user exists in the admin collection or has admin privileges.
   - **Weakness:** Inconsistent usage in `routes/adminRoute.js` (e.g., `POST /admin/submit-suggested-changes` mistakenly uses user token middleware instead of admin middleware).

3. **`middleware/authMiddleware.js` (Legacy User Middleware)**
   - Directly calls `jwt.verify(token, process.env.JWT_SECRET)`.
   - Bypasses the RS256 public key verification in `tokenService.js`.
   - Still imported in `controllers/usersControllers.js` and `controllers/v2/usersController.js`.
   - **Vulnerability (SEC-010):** Inherits the weak, leaked secret from git history.

4. **`middleware/publisherMiddleware.js` (Contributor Middleware)**
   - Custom token verification for content publishers.
   - **Vulnerability (SEC-003):** Falls back to hardcoded string `"sb2318@ultimatehealth_refresh"`.

---

## 3. JWT Implementation & Cryptographic Posture

### 3.1. Secret Key Management & Fallbacks (SEC-002, SEC-003)
Inspection of `services/security/tokenService.js` reveals dangerous fallback patterns:
```javascript
// services/security/tokenService.js lines 43-46
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "fallback_access_secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret";
const VERIFICATION_SECRET = process.env.JWT_VERIFICATION_SECRET || "fallback_verification_secret";
```
- **Risk:** In environments where environment variables fail to load (container restart error, misconfigured orchestrator), the system silently accepts predictable keys.
- **Remediation:** Application must terminate immediately on startup if cryptographic secrets are absent.

### 3.2. Token Expiration and Refresh Lifecycle
- **Access Tokens:** Signed with a 15-minute lifespan (`15m`).
- **Refresh Tokens:** Signed with a 7-day lifespan (`7d`).
- **Token Rotation:** `services/security/tokenService.js` implements single-use refresh token rotation. When a refresh token is exchanged, a new JTI is generated and stored in Redis.
- **Revocation:** Redis keys `revoked_tokens:${jti}` and `user_token_version:${userId}` allow global logout. However, legacy endpoints bypassing `tokenService` do not honor these revocation keys.

---

## 4. Authorization & Privilege Escalation Analysis

### 4.1. Broken Object Level Authorization (BOLA / IDOR)

#### SEC-006: Modification of Arbitrary Articles via `submitSuggestedChanges`
- **Route:** `POST /api/admin/submit-suggested-changes` in `routes/adminRoute.js`
- **Controller:** `controllers/admin/articleReviewController.js` lines 340–345
- **Flaw:** The author verification block was commented out during development:
  ```javascript
  // if (article.authorId.toString() !== userId.toString()) {
  //     return res.status(403).json({ message: "Unauthorized" });
  // }
  ```
- **Impact:** Any user with a valid standard JWT can submit modifications to any article ID, altering title, markdown content, tags, and summary without author or moderator consent.

#### SEC-007: Unauthorized Metrics & Activity Access in Analytics
- **Routes:**
  - `GET /api/analytics/total-reads/:userId`
  - `GET /api/analytics/total-writes/:userId`
  - `GET /api/analytics/user-stats/:userId`
- **Flaw:** The routes enforce `authenticateToken`, ensuring the caller is logged in, but fail to compare `req.userId` with `req.params.userId`.
- **Impact:** Any registered user can enumerate analytics data and reading/writing statistics for all other users.

### 4.2. Broken Function Level Authorization (BFLA)

#### SEC-005: Unauthenticated Admin User Deletion
- **Route:** `POST /api/admin/deleteUser` in `routes/usersRoutes.js`
- **Controller:** `controllers/usersControllers.js` line 889
- **Flaw:** Completely lacks middleware. It processes incoming request body parameters (`adminEmail`, `adminPassword`, `userIdToDelete`) in the controller without rate limiting or JWT authentication.

---

## 5. Route-Permission Matrix

| Route Pattern | Public | User | Doctor | Admin / Moderator | Observed Middleware | Security Assessment |
|---|:---:|:---:|:---:|:---:|---|---|
| `POST /api/v2/users/register` | ✅ | ❌ | ❌ | ❌ | None (Zod Validated) | ✅ Intended behavior |
| `POST /api/v2/users/login` | ✅ | ❌ | ❌ | ❌ | Rate Limiter | ✅ Intended behavior |
| `POST /api/admin/deleteUser` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | **None** | 🔴 **CRITICAL (SEC-005)** |
| `POST /api/admin/submit-suggested-changes` | ❌ | ⚠️ | ⚠️ | ⚠️ | `authToken` (User) | 🔴 **CRITICAL (SEC-006)** |
| `POST /api/upload-storage` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | **None** | 🔴 **CRITICAL (SEC-004)** |
| `GET /api/getFile/:key` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Selective (in controller) | 🟠 **HIGH (SEC-015)** |
| `GET /api/analytics/user-stats/:userId` | ❌ | ⚠️ | ⚠️ | ✅ | `authenticateToken` | 🟠 **HIGH (SEC-007: BOLA)** |
| `GET /api/wellness/weekly` | ❌ | ✅ | ✅ | ❌ | `authToken` (User) | ✅ Properly scoped to `req.userId` |
| `GET /api/wellness/patient/:patientId` | ❌ | ❌ | ✅ | ❌ | `authToken` + Doctor Check | ✅ Validates Care Team consent |
| `POST /api/care-team/break-glass` | ❌ | ❌ | ✅ | ❌ | `authToken` + Doctor Check | ✅ Logs HIPAA critical event |
| `POST /api/report/take-admin-action` | ❌ | ❌ | ❌ | ✅ | `adminAuthenticateToken` | ✅ Admin gated |
| `POST /api/notification` | ❌ | ⚠️ | ⚠️ | ⚠️ | `authenticateToken` | 🟡 **MEDIUM (SEC-023: No scope)** |
| `GET /api/health/circuit-breakers` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | **None** | 🟡 **MEDIUM (Operational leak)** |
| `GET /hello` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | **None** | 🟢 **LOW (Debug route)** |

---

## 6. Recommendations & Remediation Plan

1. **Unify Middleware Layers**:
   - Retire `middleware/authMiddleware.js` and `middleware/publisherMiddleware.js`.
   - Ensure all routes consume either `authentcatetoken.js` (general user/doctor) or `adminAuthenticateToken.js` (privileged actions).
2. **Eliminate Cryptographic Fallbacks**:
   - Refactor `config/env.js` and `tokenService.js` to throw a fatal exception if `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, or RSA keys are absent.
3. **Enforce Ownership Verification**:
   - Restore the commented-out author verification in `controllers/admin/articleReviewController.js`.
   - Standardize parameterized routes (`/:userId`) to extract user identity directly from `req.userId` rather than route parameters whenever operating on the caller's own context.
4. **Secure Admin Routes**:
   - Mount all administrative routes behind a router-level middleware stack enforcing `adminAuthenticateToken`.
