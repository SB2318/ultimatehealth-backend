# UltimateHealth Backend — Remediation Roadmap

**Audit Date:** 2026-11-17  
**Scope:** Actionable, Prioritized Engineering Roadmap for Security Hardening  
**Application:** UltimateHealth Backend (`main` @ `6e3392d`)  

---

## 1. Roadmap Overview & Timeline

The remediation plan is structured into four sequential phases based on risk, exploitability, and operational impact:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 0: Immediate Emergency Actions (Within 24 Hours)                 │
│ Credential rotation, Docker port containment, Redis password            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 1: High-Priority Access Control Patches (Within 48–72 Hours)     │
│ BOLA fixes, unauthenticated upload closure, hardcoded fallback removal │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 2: Infrastructure & Middleware Hardening (Within 1–2 Weeks)      │
│ Body limit reduction, error handler bug, npm dependency patching       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 3: Architectural Resilience & Compliance (Within 30 Days)        │
│ Middleware consolidation, Kafka TLS/SASL, CI/CD secret scanning        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 0: Immediate Emergency Actions (Within 24 Hours)

### Task 0.1: Credential Rotation (SEC-001)
- **Target:** Secrets leaked in historical commits `b8a29bf` and `7768a59`.
- **Actions:**
  1. **MongoDB Atlas:**
     - Log in to MongoDB Atlas cloud console.
     - Change the password for database user `sb2318`.
     - Update IP Access List: Ensure `0.0.0.0/0` is removed and only the production server IP is whitelisted.
     - Update production `.env` with the new connection string.
  2. **JWT Signing Secrets:**
     - Generate new, cryptographically random 256-bit secrets for:
       - `JWT_ACCESS_SECRET`
       - `JWT_REFRESH_SECRET`
       - `JWT_VERIFICATION_SECRET`
       - `TOKEN_SECRET`
     - Generate a new RSA 2048-bit keypair for `keys/private.key` and `keys/public.key`.
  3. **Google Mail Credentials:**
     - Revoke the compromised Gmail App Password in Google Account Security settings.
     - Generate a fresh 16-character App Password and update `EMAIL_PASS`.

### Task 0.2: Docker Container Port Containment (SEC-017, SEC-018, SEC-019, SEC-020)
- **Target:** `docker-compose.yml`
- **Actions:**
  Update port bindings so sensitive internal infrastructure services are not published to `0.0.0.0`:
  ```yaml
  mongodb:
    ports:
      - "127.0.0.1:27017:27017"

  kafka1:
    ports:
      - "127.0.0.1:9092:9092"

  pocketbase:
    ports:
      - "127.0.0.1:8090:8090"

  redis:
    ports:
      - "127.0.0.1:6379:6379"
  ```

### Task 0.3: Redis Password Enforcement (SEC-018)
- **Target:** `docker-compose.yml` & `config/redis.js`
- **Actions:**
  1. Add `command: redis-server --requirepass ${REDIS_PASSWORD}` to the `redis` service in `docker-compose.yml`.
  2. Set `REDIS_PASSWORD` in `.env` with a strong random string.
  3. In `config/redis.js`, enforce that connection fails if `REDIS_PASSWORD` is undefined.

---

## 3. Phase 1: High-Priority Access Control Patches (Within 48–72 Hours)

### Task 1.1: Secure File Upload Endpoint (SEC-004)
- **Target:** `routes/uploadRoute.js` line 21
- **Action:** Add `authenticateToken` middleware:
  ```javascript
  const authenticateToken = require("../middleware/authentcatetoken");
  router.post('/upload-storage', authenticateToken, upload.single('file'), uploadFile);
  ```
- Disallow `text/html` from general upload mimetypes in `controllers/uploadController.js`.

### Task 1.2: Restore Author Ownership Check in Suggested Changes (SEC-006)
- **Target:** `controllers/admin/articleReviewController.js` lines 340–345
- **Action:** Uncomment author verification:
  ```javascript
  if (article.authorId.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: "Forbidden: You are not the author of this article" });
  }
  ```

### Task 1.3: Secure `/admin/deleteUser` Endpoint (SEC-005)
- **Target:** `routes/usersRoutes.js` line 202
- **Action:** Apply `adminAuthenticateToken` middleware:
  ```javascript
  const adminAuthenticateToken = require('../middleware/adminAuthenticateToken');
  router.post('/admin/deleteUser', adminAuthenticateToken, deleteByAdmin);
  ```
  Refactor `deleteByAdmin` controller to remove reliance on body credentials (`adminEmail`, `adminPassword`).

### Task 1.4: Fix BOLA on Analytics Endpoints (SEC-007)
- **Target:** `routes/analyticsRoute.js` & `controllers/analyticsController.js`
- **Action:** Verify ownership or eliminate the route parameter:
  ```javascript
  if (req.userId !== req.params.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: "Access denied" });
  }
  ```

### Task 1.5: Eliminate Hardcoded Fallback Secrets (SEC-002, SEC-003)
- **Target:** `services/security/tokenService.js` and `middleware/publisherMiddleware.js`
- **Action:** Remove fallback strings:
  ```javascript
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.error("FATAL: Missing JWT signing secrets in environment");
      process.exit(1);
  }
  ```

### Task 1.6: Remove Token and Credential Console Logging (SEC-009)
- **Target:** `controllers/emailservice.js` line 245 and `controllers/usersControllers.js`
- **Action:** Delete `console.log("Generated verification token:", verificationToken)` and sanitise user serialization logs.

---

## 4. Phase 2: Infrastructure & Middleware Hardening (Within 1–2 Weeks)

### Task 2.1: Enforce Safe Express Request Limits (SEC-008)
- **Target:** `index.js` lines 104–105
- **Action:** Lower JSON limit from `50mb` to `2mb`:
  ```javascript
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));
  ```

### Task 2.2: Fix Production Error Handler Case Sensitivity (SEC-012)
- **Target:** `middleware/errorHandler.js` line 80
- **Action:**
  ```javascript
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (isProduction) {
      return res.status(statusCode).json({
          status: 'error',
          code: errorCode,
          message: err.isOperational ? err.message : 'An unexpected internal error occurred'
      });
  }
  ```

### Task 2.3: Restrict Swagger UI in Production (SEC-021)
- **Target:** `index.js` lines 157–158
- **Action:** Gate documentation routes behind environment flag or basic authentication:
  ```javascript
  if (process.env.NODE_ENV !== 'production') {
      app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
      app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }
  ```

### Task 2.4: Patch Vulnerable npm Dependencies (SEC-014)
- **Target:** `package.json`
- **Actions:**
  1. Run `npm audit fix`.
  2. Upgrade `ws` to patched version (`>= 8.18.0`).
  3. Upgrade `zod` to `>= 3.23.8` (or current stable release).
  4. Run integration regression tests to verify schema parsing stability.

### Task 2.5: Remove Debug Routes (SEC-022)
- **Target:** `index.js` line 163
- **Action:** Delete `app.get("/hello", ...)` route.

---

## 5. Phase 3: Architectural Resilience & Compliance (Within 30 Days)

### Task 3.1: Middleware Consolidation
- Deprecate `middleware/authMiddleware.js`.
- Migrate all legacy controller imports to consume `middleware/authentcatetoken.js` or `middleware/authenticate.js` exclusively.

### Task 3.2: Git History Sanitization
- Use `git-filter-repo` on a maintenance clone to purge `.env` from all historic commits:
  ```bash
  git filter-repo --path .env --invert-paths
  ```
- Force push cleaned branches and tags. (Coordinate with development team to re-clone).

### Task 3.3: Automated DevSecOps Pipeline
- Implement GitHub Actions security scanning:
  - **Secret Detection:** Gitleaks or Trufflehog to block commits containing API keys or connection strings.
  - **Dependency Auditing:** Daily automated Dependabot security alerts.
  - **Static Analysis (SAST):** Semgrep or CodeQL configured for Node.js / Express security rules.
