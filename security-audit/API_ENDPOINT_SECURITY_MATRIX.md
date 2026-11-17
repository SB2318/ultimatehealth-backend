# UltimateHealth Backend — API Endpoint Security Matrix

**Audit Date:** 2026-11-17  
**Scope:** Complete Route Mapping across 23 Route Files  
**Application:** UltimateHealth Backend (`main` @ `6e3392d`)  

---

## 1. Authentication & Role Legend

- **AUTH STATUS:**
  - 🟢 `Enforced`: Strong authentication required (`authentcatetoken.js` or `adminAuthenticateToken.js`).
  - 🟡 `Selective / Partial`: Custom or in-controller check, or unauthenticated fallback.
  - 🔴 `Missing / Bypassed`: Completely unauthenticated or ownership check disabled.
  - ⚪ `Public`: Intentionally public endpoint.
- **ROLES:**
  - `Any`: Publicly accessible without login.
  - `User`: Standard authenticated user (`role: user`).
  - `Doctor`: Authenticated healthcare provider (`isDoctor: true` / `role: doctor`).
  - `Admin`: Moderator or Administrator (`role: admin`).

---

## 2. Comprehensive Endpoint Security Matrix

### 2.1. Authentication, Identity & User Management (`routes/usersRoutes.js`)

| Method | Path | Auth Middleware | Expected Role | Rate Limit | Input Validation | Ownership Verified | Security Finding / Status |
|---|---|---|---|:---:|:---:|:---:|---|
| `POST` | `/api/v2/users/register` | None | Any | ❌ | ✅ Zod Schema | N/A | ⚪ Public registration |
| `POST` | `/api/v2/users/login` | None | Any | ✅ Login Limiter | ✅ Zod Schema | N/A | ⚪ Public login |
| `POST` | `/api/v2/users/google-auth` | None | Any | ❌ | ✅ Zod Schema | N/A | ⚪ Google OAuth handler |
| `POST` | `/api/v2/users/checkUserHandle` | None | Any | ❌ | ✅ Zod Schema | N/A | ⚪ Handle availability check |
| `GET` | `/api/v2/users/getprofile` | `authentcatetoken` | User / Doctor | ❌ | N/A | ✅ Via `req.userId` | 🟢 Secure |
| `GET` | `/api/v2/users/getUserProfile` | None | Any | ❌ | ✅ Zod Query | N/A | ⚪ Public profile (safe fields) |
| `POST` | `/api/v2/users/forgotPassword` | None | Any | ✅ Rate Limit | ✅ Zod Schema | N/A | ⚪ Sends hashed OTP via mail |
| `POST` | `/api/v2/users/verifyOtp` | None | Any | ✅ Rate Limit | ✅ Zod Schema | N/A | ⚪ Verifies 6-digit OTP |
| `POST` | `/api/v2/users/updatePassword` | `authentcatetoken` | User / Doctor | ❌ | ✅ Zod Schema | ✅ Via `req.userId` | 🟢 Secure |
| `POST` | `/api/v2/users/deleteAccount` | `authentcatetoken` | User / Doctor | ❌ | ✅ Zod Schema | ✅ Via `req.userId` | 🟢 Secure |
| `POST` | `/api/refresh` | None (Refresh JWT) | Any | ❌ | Token Parse | N/A | 🟢 Single-use JTI rotation |
| `POST` | `/api/logout` | `authentcatetoken` | User / Doctor | ❌ | N/A | ✅ Via `req.userId` | 🟢 Invalidates token in Redis |
| `POST` | `/api/admin/deleteUser` | **None** | Admin | ❌ | None | ❌ **No Auth Middleware** | 🔴 **CRITICAL (SEC-005)** |

---

### 2.2. Administrative & Content Moderation (`routes/adminRoute.js`, `routes/adminAuthRoute.js`)

| Method | Path | Auth Middleware | Expected Role | Rate Limit | Input Validation | Ownership Verified | Security Finding / Status |
|---|---|---|---|:---:|:---:|:---:|---|
| `POST` | `/api/admin/login` | None | Any | ✅ Rate Limit | Basic | N/A | ⚪ Admin Login |
| `GET` | `/api/admin/articles-for-review` | `adminAuthenticateToken` | Admin | ❌ | None | N/A (Admin) | 🟢 Secure |
| `GET` | `/api/admin/review-progress/:reviewer_id` | `adminAuthenticateToken` | Admin | ❌ | Param | N/A (Admin) | 🟢 Secure |
| `POST` | `/api/admin/moderator-self-assign` | `adminAuthenticateToken` | Admin | ❌ | Body | N/A (Admin) | 🟢 Secure |
| `POST` | `/api/admin/submit-review` | `adminAuthenticateToken` | Admin | ❌ | Body | N/A (Admin) | 🟢 Secure |
| `POST` | `/api/admin/submit-suggested-changes` | `authentcatetoken` (User!) | User / Admin | ❌ | Body | ❌ **Commented Out** | 🔴 **CRITICAL (SEC-006: BOLA)** |
| `POST` | `/api/admin/publish-article` | `adminAuthenticateToken` | Admin | ❌ | Body | N/A (Admin) | 🟢 Secure |
| `POST` | `/api/admin/discard-changes` | `adminAuthenticateToken` | Admin | ❌ | Body | N/A (Admin) | 🟢 Secure |
| `POST` | `/api/admin/unassign-moderator` | `adminAuthenticateToken` | Admin | ❌ | Body | N/A (Admin) | 🟢 Secure |

---

### 2.3. Storage, Uploads & Content Retrieval (`routes/uploadRoute.js`)

| Method | Path | Auth Middleware | Expected Role | Rate Limit | Input Validation | Ownership Verified | Security Finding / Status |
|---|---|---|---|:---:|:---:|:---:|---|
| `POST` | `/api/upload-storage` | **None** | Any | ❌ | Multer (Partial) | ❌ **No Auth** | 🔴 **CRITICAL (SEC-004)** |
| `POST` | `/api/upload-resume` | `authentcatetoken` | User / Doctor | ❌ | PDF / Word | ✅ Via `req.userId` | 🟢 Secure |
| `GET` | `/api/getFile/:key` | Selective (in controller) | Mixed | ❌ | Key sanitize | ⚠️ Partial | 🟠 **HIGH (SEC-015: S3 Proxy)** |
| `GET` | `/api/articles/get-article-content/:id` | None | Any | ❌ | Param | N/A | ⚪ Public published content |

---

### 2.4. Analytics & Telemetry (`routes/analyticsRoute.js`)

| Method | Path | Auth Middleware | Expected Role | Rate Limit | Input Validation | Ownership Verified | Security Finding / Status |
|---|---|---|---|:---:|:---:|:---:|---|
| `GET` | `/api/analytics/total-reads/:userId` | `authentcatetoken` | User | ❌ | Param | ❌ **Missing check** | 🟠 **HIGH (SEC-007: BOLA)** |
| `GET` | `/api/analytics/total-writes/:userId` | `authentcatetoken` | User | ❌ | Param | ❌ **Missing check** | 🟠 **HIGH (SEC-007: BOLA)** |
| `GET` | `/api/analytics/user-stats/:userId` | `authentcatetoken` | User | ❌ | Param | ❌ **Missing check** | 🟠 **HIGH (SEC-007: BOLA)** |
| `POST` | `/api/analytics/record-event` | `authentcatetoken` | User | ❌ | Body | ✅ Via `req.userId` | 🟢 Secure |

---

### 2.5. Clinical & HIPAA Regulated Endpoints (`routes/wellnessRoute.js`, `routes/careTeamRoutes.js`)

| Method | Path | Auth Middleware | Expected Role | Rate Limit | Input Validation | Ownership Verified | Security Finding / Status |
|---|---|---|---|:---:|:---:|:---:|---|
| `POST` | `/api/wellness/log` | `authentcatetoken` | User | ❌ | Body JSON | ✅ Via `req.userId` | 🟢 Secure (Audit logged) |
| `GET` | `/api/wellness/weekly` | `authentcatetoken` | User | ❌ | None | ✅ Via `req.userId` | 🟢 Secure |
| `GET` | `/api/wellness/patient/:patientId` | `authentcatetoken` | Doctor | ❌ | Param | ✅ Care team consent check | 🟢 Secure (HIPAA § 164.502) |
| `GET` | `/api/wellness/export` | `authentcatetoken` | User | ❌ | None | ✅ Via `req.userId` | 🟢 Secure (HIPAA § 164.524) |
| `POST` | `/api/wellness/plan/generate` | `authentcatetoken` | User | ✅ AI Plan Limiter | Schema | ✅ Via `req.userId` | 🟢 Secure |
| `POST` | `/api/care-team/assign` | `authentcatetoken` | User | ❌ | Body | ✅ Via `req.userId` | 🟢 Secure |
| `GET` | `/api/care-team/my-doctors` | `authentcatetoken` | User | ❌ | None | ✅ Via `req.userId` | 🟢 Secure |
| `GET` | `/api/care-team/my-patients` | `authentcatetoken` | Doctor | ❌ | None | ✅ Doctor role verified | 🟢 Secure |
| `POST` | `/api/care-team/revoke-consent` | `authentcatetoken` | User | ❌ | Body | ✅ Via `req.userId` | 🟢 Secure |
| `POST` | `/api/care-team/interactions` | `authentcatetoken` | User / Doctor | ❌ | Body | ✅ Care team check | 🟢 Secure (Append-only) |
| `POST` | `/api/care-team/break-glass` | `authentcatetoken` | Doctor | ❌ | Body (Justification)| ✅ Doctor role verified | 🟢 Secure (Critical audit log) |
| `GET` | `/api/care-team/audit-disclosures` | `authentcatetoken` | User | ❌ | None | ✅ Via `req.userId` | 🟢 Secure (HIPAA § 164.528) |

---

### 2.6. AI & Chatbot Endpoints (`routes/aiRoute.js`)

| Method | Path | Auth Middleware | Expected Role | Rate Limit | Input Validation | Ownership Verified | Security Finding / Status |
|---|---|---|---|:---:|:---:|:---:|---|
| `POST` | `/api/gemini/send` | `authentcatetoken` | User | ✅ 5 msgs/day quota | Body | ✅ Via `req.userId` | 🟢 PHI Sanitized & Audit Logged |
| `GET` | `/api/gemini/messages` | `authentcatetoken` | User | ❌ | Query | ✅ Via `req.userId` | 🟢 Secure |
| `DELETE`| `/api/gemini/messages` | `authentcatetoken` | User | ❌ | Query | ✅ Via `req.userId` | 🟢 Secure (HIPAA Deletion) |
| `GET` | `/api/gemini/export` | `authentcatetoken` | User | ❌ | None | ✅ Via `req.userId` | 🟢 Secure (Right of Access) |
| `GET` | `/api/gemini/characters` | `authentcatetoken` | User | ❌ | None | N/A | 🟢 Secure |

---

### 2.7. Notifications & Reporting (`routes/notificationRoute.js`, `routes/reportRoute.js`)

| Method | Path | Auth Middleware | Expected Role | Rate Limit | Input Validation | Ownership Verified | Security Finding / Status |
|---|---|---|---|:---:|:---:|:---:|---|
| `POST` | `/api/notification` | `authentcatetoken` | User | ❌ | Body | ❌ **Target unrestricted** | 🟡 **MEDIUM (SEC-023: Spam)** |
| `GET` | `/api/notifications` | `authentcatetoken` | User / Admin | ❌ | Query | ✅ Via `req.userId` | 🟢 Secure |
| `PUT` | `/api/notifications/mark-as-read` | `authentcatetoken` | User / Admin | ❌ | Body | ✅ Via `req.userId` | 🟢 Secure |
| `DELETE`| `/api/notification/:id` | `authentcatetoken` | User | ❌ | Param | ✅ Ownership check | 🟢 Secure |
| `POST` | `/api/report/submit` | `authentcatetoken` | User | ❌ | Body | ✅ Via `req.userId` | 🟢 Secure |
| `GET` | `/api/report/pending-reports` | `adminAuthenticateToken` | Admin | ❌ | None | N/A (Admin) | 🟢 Secure |
| `POST` | `/api/report/take-admin-action` | `adminAuthenticateToken` | Admin | ❌ | Body | N/A (Admin) | 🟢 Secure |

---

### 2.8. Server Diagnostic & Documentation Endpoints (`index.js`)

| Method | Path | Auth Middleware | Expected Role | Rate Limit | Input Validation | Ownership Verified | Security Finding / Status |
|---|---|---|---|:---:|:---:|:---:|---|
| `GET` | `/docs` / `/api/docs` | None | Any | ❌ | N/A | N/A | 🟡 **MEDIUM (SEC-021: Swagger)** |
| `GET` | `/api/health/circuit-breakers` | None | Any | ❌ | N/A | N/A | 🟡 **MEDIUM (Diagnostic leak)** |
| `GET` | `/hello` | None | Any | ❌ | N/A | N/A | 🟢 **LOW (SEC-022: Test route)** |
| `GET` | `/` | None | Any | ❌ | N/A | N/A | ⚪ Redirects to marketing site |
| `GET` | `/.well-known/assetlinks.json` | None | Any | ❌ | N/A | N/A | ⚪ Android app linking |
