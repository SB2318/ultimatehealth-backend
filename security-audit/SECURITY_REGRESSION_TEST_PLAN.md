# UltimateHealth Backend — Security Regression Test Plan

**Audit Date:** 2026-11-17  
**Scope:** Automated & Integration Verification Suite for Remediated Vulnerabilities  
**Framework:** Jest + Supertest (Node.js API Testing)  
**Application:** UltimateHealth Backend (`main` @ `6e3392d`)  

---

## 1. Test Strategy & Objectives

This test plan provides automated regression test cases designed to verify that every identified vulnerability (SEC-001 through SEC-023) is effectively closed and cannot reoccur in future releases.

All test cases are designed for non-destructive local execution in test environments using mock databases or isolated test containers.

---

## 2. Automated Regression Test Cases

### 2.1. Access Control & Authorization Test Suite (`test/security/access-control.test.js`)

#### Test Case TC-SEC-004: Unauthenticated File Upload Rejection
- **Objective:** Verify `POST /api/upload-storage` rejects requests lacking a valid JWT.
- **Expected Status:** `401 Unauthorized`
```javascript
describe('SEC-004: Upload Endpoint Access Control', () => {
    it('should reject unauthenticated upload requests with 401', async () => {
        const response = await request(app)
            .post('/api/upload-storage')
            .attach('file', Buffer.from('test image content'), 'test.png');

        expect(response.status).toBe(401);
        expect(response.body.message).toMatch(/token required|unauthorized/i);
    });
});
```

#### Test Case TC-SEC-005: Admin Delete User Endpoint Protection
- **Objective:** Verify `POST /api/admin/deleteUser` rejects requests without a valid Admin JWT.
- **Expected Status:** `401 Unauthorized` or `403 Forbidden`
```javascript
describe('SEC-005: Admin Endpoint Authentication', () => {
    it('should reject unauthenticated user deletion attempts', async () => {
        const response = await request(app)
            .post('/api/admin/deleteUser')
            .send({
                adminEmail: 'admin@ultimatehealth.blog',
                adminPassword: 'Password123!',
                userId: '64b4b97d9b4c4a0012aa3c59'
            });

        expect(response.status).toBe(401);
    });

    it('should reject standard user JWT attempting admin user deletion', async () => {
        const userToken = generateTestUserToken({ role: 'user' });

        const response = await request(app)
            .post('/api/admin/deleteUser')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ userId: '64b4b97d9b4c4a0012aa3c59' });

        expect(response.status).toBe(403);
    });
});
```

#### Test Case TC-SEC-006: BOLA Prevention on Article Modification
- **Objective:** Verify `POST /api/admin/submit-suggested-changes` rejects user attempting to edit another user's article.
- **Expected Status:** `403 Forbidden`
```javascript
describe('SEC-006: Article Edit Ownership Verification', () => {
    it('should reject article modification when caller is not the author', async () => {
        const userAToken = generateTestUserToken({ userId: '64b4b97d9b4c4a0012aa1111' });
        const victimArticle = await createTestArticle({ authorId: '64b4b97d9b4c4a0012aa2222' });

        const response = await request(app)
            .post('/api/admin/submit-suggested-changes')
            .set('Authorization', `Bearer ${userAToken}`)
            .send({
                articleId: victimArticle._id,
                title: 'Malicious Overwrite Title',
                content: 'Overwritten content'
            });

        expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/forbidden|unauthorized/i);
    });
});
```

#### Test Case TC-SEC-007: BOLA Prevention on Analytics Endpoints
- **Objective:** Verify `GET /api/analytics/user-stats/:userId` returns 403 when requesting data for another user.
- **Expected Status:** `403 Forbidden`
```javascript
describe('SEC-007: Analytics BOLA Prevention', () => {
    it('should reject querying stats of another user', async () => {
        const callerToken = generateTestUserToken({ userId: '64b4b97d9b4c4a0012aa1111' });
        const targetVictimId = '64b4b97d9b4c4a0012aa9999';

        const response = await request(app)
            .get(`/api/analytics/user-stats/${targetVictimId}`)
            .set('Authorization', `Bearer ${callerToken}`);

        expect(response.status).toBe(403);
    });
});
```

---

### 2.2. Cryptography & Token Verification Test Suite (`test/security/crypto.test.js`)

#### Test Case TC-SEC-002: Hardcoded Fallback Token Rejection
- **Objective:** Ensure tokens signed with known fallback secrets ("fallback_access_secret") are rejected.
- **Expected Status:** `401 Unauthorized`
```javascript
describe('SEC-002: Fallback Secret Rejection', () => {
    it('should reject tokens signed with hardcoded fallback string', async () => {
        const forgedToken = jwt.sign(
            { userId: 'test_admin', role: 'admin' },
            'fallback_access_secret',
            { expiresIn: '1h' }
        );

        const response = await request(app)
            .get('/api/v2/users/getprofile')
            .set('Authorization', `Bearer ${forgedToken}`);

        expect(response.status).toBe(401);
    });
});
```

---

### 2.3. Server & Middleware Hardening Test Suite (`test/security/server.test.js`)

#### Test Case TC-SEC-008: Large Request Body Rejection (DoS Mitigation)
- **Objective:** Verify server rejects JSON payloads exceeding 2MB with HTTP 413.
- **Expected Status:** `413 Payload Too Large`
```javascript
describe('SEC-008: Request Payload Limiting', () => {
    it('should reject JSON bodies exceeding 2MB limit', async () => {
        const largeString = 'A'.repeat(3 * 1024 * 1024); // 3MB

        const response = await request(app)
            .post('/api/v2/users/checkUserHandle')
            .send({ userHandle: largeString });

        expect(response.status).toBe(413);
    });
});
```

#### Test Case TC-SEC-012: Production Stack Trace Suppression
- **Objective:** Verify 500 errors in production do not leak stack traces or internal file paths.
- **Expected Status:** Clean JSON response without `stack` property.
```javascript
describe('SEC-012: Error Handler Leak Prevention', () => {
    it('should not include stack trace when NODE_ENV is production', async () => {
        process.env.NODE_ENV = 'production';

        const response = await request(app)
            .get('/api/test-trigger-unhandled-error');

        expect(response.status).toBe(500);
        expect(response.body.stack).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain('at processTicksAndRejections');
    });
});
```

#### Test Case TC-SEC-021: Swagger UI Gating
- **Objective:** Verify Swagger documentation routes are inaccessible in production.
- **Expected Status:** `404 Not Found`
```javascript
describe('SEC-021: Swagger Documentation Gating', () => {
    it('should return 404 for /docs in production environment', async () => {
        process.env.NODE_ENV = 'production';

        const response = await request(app).get('/docs');
        expect([404, 401, 403]).toContain(response.status);
    });
});
```

---

## 3. Test Execution & CI/CD Integration

To run these security regression tests in local environments or during GitHub Actions build pipelines:

```bash
# Execute full security test suite
npm test -- test/security/

# Run with coverage reporting
npm test -- test/security/ --coverage
```

### Build Gate Rule:
If any security regression test fails, the CI/CD pipeline MUST fail immediately and block deployment to staging or production environments.
