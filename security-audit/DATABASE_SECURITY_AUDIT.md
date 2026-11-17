# UltimateHealth Backend — Database Security Audit

**Audit Date:** 2026-11-17  
**Scope:** MongoDB (Atlas & Self-Hosted), Redis Cache, PocketBase Auxiliary Store, Data Sanitization, Query Safety, and Exposure  
**Application:** UltimateHealth Backend (`main` @ `6e3392d`)  

---

## 1. Executive Summary

UltimateHealth relies on **MongoDB** as its primary document store, **Redis** for token invalidation and rate limiting, and **PocketBase** as a supplementary data source.

While application-layer defenses such as `express-mongo-sanitize` are integrated in the Express middleware pipeline, several critical architectural and network-level database vulnerabilities exist:
- Plaintext database credentials committed to version control history (SEC-001).
- Silent fallback to an unauthenticated local MongoDB instance upon Atlas network errors (SEC-016).
- Unrestricted public binding (`0.0.0.0:27017` and `0.0.0.0:6379`) for both MongoDB and Redis in container deployment configurations (SEC-017, SEC-018).
- Redis operating without authentication credentials.

---

## 2. MongoDB Architecture & Connection Security

### 2.1. Credential Leakage in Git History (SEC-001)
- **Findings:** Historical commits (`b8a29bf`, `7768a59`) contained complete MongoDB Atlas connection strings with embedded username and password credentials:
  ```text
  mongodb+srv://sb2318:[REDACTED]@db-ultimatehealth.jkbnq.mongodb.net/?retryWrites=true&w=majority
  ```
- **Risk:** Anyone with read access to the Git repository can extract these credentials and directly connect to the Atlas cluster, bypassing all application-level controls, IP filters (if 0.0.0.0/0 was permitted in Atlas), and audit trails.

### 2.2. Silent Fallback to Unauthenticated Local Database (SEC-016)
Inspection of `config/database.js` lines 3–26:
```javascript
const primaryUri = process.env.MONGODB_URL;
const fallbackUri = "mongodb://127.0.0.1:27017/ultimate_health";

try {
    await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 6000 });
} catch (error) {
    console.warn("⚠️ Primary DB connection failed:", error.message);
    try {
        await mongoose.connect(fallbackUri, { serverSelectionTimeoutMS: 6000 });
    } ...
}
```
- **Risk:**
  1. If Atlas encounters transient network failures or timeout, the server automatically connects to an unauthenticated local database on `127.0.0.1:27017`.
  2. The local database has no root username, password, or role-based access control configured in `docker-compose.yml`.
  3. Writes and updates during downtime land on an unencrypted, unsecured local database without administrative oversight.

---

## 3. Query Security & Injection Vulnerabilities

### 3.1. NoSQL Injection Defenses
- **Middleware:** `app.use(mongoSanitize())` is active in `index.js` (line 107).
  - Sanitizes `req.body`, `req.query`, and `req.params` by stripping keys starting with `$` or containing `.`.
- **Zod Validation:** `v2` endpoints in `controllers/v2/usersController.js` and `validators/auth.schema.js` enforce strict string validation, regex format checks (such as 24-character hexadecimal MongoDB ObjectIds), and object structural enforcement.
- **Legacy Routes:** Certain older endpoints in `controllers/usersControllers.js` pass request body values directly to Mongoose queries (e.g., `User.findOne({ email: req.body.email })`). While `mongoSanitize()` mitigates basic operator injection (e.g., `{"$gt": ""}`), reliance on middleware without schema parsing leaves residual risk for unexpected types.

### 3.2. Projection & Sensitive Field Exposure
- **Schema Defaults:**
  - `password`: Enforces `select: false` in `models/UserModel.js`. However, queries using `.select('+password')` for authentication must be scrutinized to ensure the hash is deleted before returning responses.
  - `otp` / `otpExpires`: In `UserModel.js`, `otp` is stored as a hash via `hashToken(otp)` rather than plaintext, which is a positive security practice.
  - `refreshTokens`: Stored in the user record. In several legacy controllers, user objects are serialized into responses or logged directly to console output (SEC-009).

### 3.3. Unbounded Queries and DoS Vectors
- **Broadcast Queries:**
  - In `services/mqueue/workers/kafkaConsumer.js` and `services/db/userService.js`, certain broadcast routines query active users without pagination:
    ```javascript
    User.find({ isBlockUser: false, isBannedUser: false })
    ```
  - As the user base grows, unbounded queries consume substantial heap space and lock I/O threads, creating resource exhaustion risks.

---

## 4. Redis Security & State Management (SEC-018)

### 4.1. Network Binding & Authentication
- **File:** `config/redis.js` and `docker-compose.yml` (line 176–188)
- **Findings:**
  - `docker-compose.yml` maps port `6379:6379` to `0.0.0.0`.
  - `config/redis.js` defaults `password: process.env.REDIS_PASSWORD || undefined`. In typical setups where `REDIS_PASSWORD` is omitted, Redis operates completely unauthenticated.
- **Risk:**
  - Redis holds sensitive state:
    - `user_token_version:${userId}`: Controls JWT validity. An attacker can write to these keys to invalidate user sessions or roll back invalidation.
    - `revoked_tokens:${jti}`: Redis blacklist for refresh tokens. Flushed or deleted entries resurrect compromised refresh tokens.
    - Rate-limiting buckets: An attacker can flush Redis keys (`FLUSHALL`) to reset rate limiters and launch unrestricted brute-force attacks.

---

## 5. PocketBase Auxiliary Store Exposure (SEC-019)

### 5.1. Exposed Admin Management Interface
- **File:** `docker-compose.yml` lines 163–174
- **Configuration:**
  ```yaml
  pocketbase:
    ports:
      - "8090:8090"
  ```
- **Findings:**
  - PocketBase is bound to `0.0.0.0:8090`.
  - PocketBase includes an embedded administrative UI at `http://<host>:8090/_/`.
  - If exposed to the internet, attackers can attempt automated credential stuffing against the PocketBase administrative interface.

---

## 6. Recommendations & Action Items

| Priority | Action Item | Target Component |
|:---:|---|---|
| **CRITICAL** | Rotate Atlas database password immediately; restrict Atlas IP access list to known production host IPs only. | MongoDB Atlas |
| **CRITICAL** | Bind MongoDB, Redis, and PocketBase ports to `127.0.0.1` in `docker-compose.yml`. | `docker-compose.yml` |
| **CRITICAL** | Enable `requirepass` in Redis and configure `REDIS_PASSWORD` in `.env`. | `config/redis.js` |
| **HIGH** | Remove silent unauthenticated local fallback in `config/database.js`. Fail fast on connection loss. | `config/database.js` |
| **MEDIUM** | Enforce pagination limits (max limit: 100) on all database queries returning multiple records. | All Services / Controllers |
| **MEDIUM** | Audit all queries referencing `select('+password')` to ensure hashes are explicitly stripped prior to sending client responses. | User Controllers |
