const request = require('supertest');
const mongoose = require('mongoose');

// Mock redis to prevent connection retry delays during test execution
jest.mock('../config/redis', () => ({
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    status: 'ready'
}));

const app = require('../server');
const HealthResource = require('../models/HealthResource');
const Admin = require('../models/admin/adminModel');
const User = require('../models/UserModel');
const { createTestUser, getAuthTokensForUser } = require('./testUtils');
const { generateAccessToken, generateRefreshToken } = require('../services/security/tokenService');
const { generateHashPassword } = require('../services/security/encryptService');

// Helper to create valid admin meeting all adminAuthenticateToken requirements
const createVerifiedAdmin = async (overrides = {}) => {
    const timestamp = Date.now();
    const adminData = {
        user_name: 'Health Admin',
        user_handle: `admin_hr_${timestamp}`,
        email: `admin_hr_${timestamp}@ultimatehealth.org`,
        password: await generateHashPassword('AdminSecret123!'),
        role: 'Moderator',
        isSuperAdmin: false,
        isVerified: true,
        signature_url: 'https://ultimatehealth.blog/signatures/admin-sig.png',
        isBlocked: false,
        ...overrides
    };
    return await Admin.create(adminData);
};

const getAdminTokens = async (admin) => {
    const payload = { userId: admin._id, role: 'admin', isSuperAdmin: admin.isSuperAdmin };
    const { accessToken } = generateAccessToken(payload, '15m');
    const { refreshToken } = await generateRefreshToken(admin._id, { role: 'admin' }, '7d');
    return { accessToken, refreshToken };
};

describe('HealthResource Module Integration & Unit Tests', () => {
    let adminUser, adminTokens;
    let normalUser, userTokens;

    beforeEach(async () => {
        await HealthResource.deleteMany({});
        await Admin.deleteMany({});
        await User.deleteMany({});

        adminUser = await createVerifiedAdmin();
        adminTokens = await getAdminTokens(adminUser);

        normalUser = await createTestUser();
        userTokens = await getAuthTokensForUser(normalUser);
    });

    describe('1. Model Validation & Business Rules', () => {
        it('should create a valid draft health resource with default values', async () => {
            const resource = new HealthResource({
                title: 'National Immunization Mission',
                description: 'Comprehensive universal immunization programme for children and pregnant women.',
                category: 'Immunization & Vaccines',
                provider: 'Ministry of Health',
                officialUrl: 'https://immunize.gov.in',
                region: 'National'
            });

            await resource.save();

            expect(resource._id).toBeDefined();
            expect(resource.slug).toBe('national-immunization-mission');
            expect(resource.status).toBe('draft');
            expect(resource.isFree).toBe(true);
            expect(resource.verification.verified).toBe(false);
            expect(resource.languages).toEqual(['en']);
        });

        it('should fail validation if required fields are missing', async () => {
            const invalidResource = new HealthResource({
                title: 'Incomplete Resource'
            });

            let error;
            try {
                await invalidResource.save();
            } catch (err) {
                error = err;
            }

            expect(error).toBeDefined();
            expect(error.errors.description).toBeDefined();
            expect(error.errors.category).toBeDefined();
            expect(error.errors.provider).toBeDefined();
            expect(error.errors.officialUrl).toBeDefined();
        });

        it('should fail validation if officialUrl is not a valid HTTP/HTTPS URL', async () => {
            const invalidUrlResource = new HealthResource({
                title: 'Invalid URL Resource',
                description: 'Valid description that has enough characters.',
                category: 'General Healthcare',
                provider: 'WHO',
                officialUrl: 'ftp://not-allowed-protocol.com'
            });

            let error;
            try {
                await invalidUrlResource.save();
            } catch (err) {
                error = err;
            }

            expect(error).toBeDefined();
            expect(error.errors.officialUrl).toBeDefined();
        });

        it('should enforce business rule: cannot save published resource when unverified', async () => {
            const unverifiedPublished = new HealthResource({
                title: 'Direct Published Attempt',
                description: 'Attempting to publish directly without prior verification.',
                category: 'Emergency Services',
                provider: 'National Emergency Response',
                officialUrl: 'https://emergency.gov.in',
                status: 'published',
                verification: { verified: false }
            });

            let error;
            try {
                await unverifiedPublished.save();
            } catch (err) {
                error = err;
            }

            expect(error).toBeDefined();
            expect(error.message).toMatch(/Unverified resources cannot be published/);
        });
    });

    describe('2. Admin Management APIs (/api/v1/health-resources/admin)', () => {
        it('should reject unauthorized / unauthenticated requests with 401', async () => {
            const res = await request(app)
                .post('/api/v1/health-resources/admin')
                .send({
                    title: 'Ayushman Bharat PM-JAY',
                    description: 'National public health insurance fund.',
                    category: 'Health Insurance & Aid',
                    provider: 'National Health Authority',
                    officialUrl: 'https://pmjay.gov.in'
                });

            expect(res.statusCode).toBe(401);
        });

        it('should reject non-admin users with 403 Forbidden', async () => {
            const res = await request(app)
                .post('/api/v1/health-resources/admin')
                .set('Authorization', `Bearer ${userTokens.accessToken}`)
                .send({
                    title: 'Ayushman Bharat PM-JAY',
                    description: 'National public health insurance fund.',
                    category: 'Health Insurance & Aid',
                    provider: 'National Health Authority',
                    officialUrl: 'https://pmjay.gov.in'
                });

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toMatch(/Admin access required/i);
        });

        it('should allow admin to create a draft resource with audit trail', async () => {
            const res = await request(app)
                .post('/api/v1/health-resources/admin')
                .set('Authorization', `Bearer ${adminTokens.accessToken}`)
                .send({
                    title: 'Ayushman Bharat PM-JAY',
                    description: 'National health protection scheme providing health cover up to INR 5 lakh per family per year.',
                    category: 'Health Insurance & Aid',
                    provider: 'National Health Authority',
                    officialUrl: 'https://pmjay.gov.in',
                    region: 'National',
                    languages: ['en', 'hi'],
                    tags: ['insurance', 'hospitalization', 'aid'],
                    sourceType: 'government'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.slug).toBe('ayushman-bharat-pm-jay');
            expect(res.body.data.status).toBe('draft');
            expect(res.body.data.verification.verified).toBe(false);
            expect(res.body.data.auditTrail).toHaveLength(1);
            expect(res.body.data.auditTrail[0].action).toBe('CREATED');
        });

        it('should prevent creating a resource directly with status published when unverified', async () => {
            const res = await request(app)
                .post('/api/v1/health-resources/admin')
                .set('Authorization', `Bearer ${adminTokens.accessToken}`)
                .send({
                    title: 'Direct Publish Test',
                    description: 'Description that meets the minimum length requirement.',
                    category: 'Emergency Support',
                    provider: 'Govt Health Body',
                    officialUrl: 'https://health.gov.in',
                    status: 'published'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/Unverified resources cannot be published/i);
        });

        it('should return 409 conflict when slug already exists', async () => {
            // First creation
            await request(app)
                .post('/api/v1/health-resources/admin')
                .set('Authorization', `Bearer ${adminTokens.accessToken}`)
                .send({
                    title: 'Duplicate Slug Resource',
                    slug: 'duplicate-slug-test',
                    description: 'Testing duplicate slug handling in admin endpoint.',
                    category: 'Initiatives',
                    provider: 'MoHFW',
                    officialUrl: 'https://mohfw.gov.in'
                });

            // Second creation with identical slug
            const res = await request(app)
                .post('/api/v1/health-resources/admin')
                .set('Authorization', `Bearer ${adminTokens.accessToken}`)
                .send({
                    title: 'Another Resource With Same Slug',
                    slug: 'duplicate-slug-test',
                    description: 'Attempting to create resource with identical slug.',
                    category: 'Initiatives',
                    provider: 'MoHFW',
                    officialUrl: 'https://mohfw.gov.in'
                });

            expect(res.statusCode).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/already exists/i);
        });

        it('should allow admin to update a resource (PATCH /admin/:id)', async () => {
            const created = await HealthResource.create({
                title: 'National Teleconsultation Service',
                description: 'eSanjeevani citizen teleconsultation platform connecting patients with doctors.',
                category: 'Telemedicine',
                provider: 'MoHFW',
                officialUrl: 'https://esanjeevani.in'
            });

            const res = await request(app)
                .patch(`/api/v1/health-resources/admin/${created._id}`)
                .set('Authorization', `Bearer ${adminTokens.accessToken}`)
                .send({
                    description: 'Updated comprehensive description of eSanjeevani service.',
                    tags: ['telehealth', 'remote-care']
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.description).toBe('Updated comprehensive description of eSanjeevani service.');
            expect(res.body.data.tags).toContain('telehealth');

            // Verify audit trail
            const updatedDoc = await HealthResource.findById(created._id);
            expect(updatedDoc.auditTrail.some(a => a.action === 'UPDATED')).toBe(true);
        });

        it('should reject updating an unverified resource to published via PATCH /admin/:id', async () => {
            const created = await HealthResource.create({
                title: 'Draft Telemedicine Resource',
                description: 'eSanjeevani citizen teleconsultation platform connecting patients with doctors.',
                category: 'Telemedicine',
                provider: 'MoHFW',
                officialUrl: 'https://esanjeevani.in',
                status: 'draft',
                verification: { verified: false }
            });

            const res = await request(app)
                .patch(`/api/v1/health-resources/admin/${created._id}`)
                .set('Authorization', `Bearer ${adminTokens.accessToken}`)
                .send({
                    status: 'published'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/Unverified resources cannot be published/i);
        });

        it('should verify a resource via PATCH /admin/:id/verify', async () => {
            const created = await HealthResource.create({
                title: 'Pradhan Mantri Matru Vandana Yojana',
                description: 'Maternity benefit programme providing conditional cash transfer.',
                category: 'Maternal & Child Health',
                provider: 'Ministry of Women and Child Development',
                officialUrl: 'https://pmmvy.wcd.gov.in'
            });

            const res = await request(app)
                .patch(`/api/v1/health-resources/admin/${created._id}/verify`)
                .set('Authorization', `Bearer ${adminTokens.accessToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.verification.verified).toBe(true);
            expect(res.body.data.verification.verifiedAt).toBeDefined();
            expect(res.body.data.verification.verifiedBy).toBe(adminUser._id.toString());
        });

        it('should enforce verification before publishing in PATCH /admin/:id/publish', async () => {
            const created = await HealthResource.create({
                title: 'Unverified Publication Candidate',
                description: 'This resource has not been reviewed by an authorized admin.',
                category: 'Public Health',
                provider: 'State Health Mission',
                officialUrl: 'https://healthmission.gov.in',
                status: 'draft',
                verification: { verified: false }
            });

            // Attempt to publish without verifying
            const publishAttempt = await request(app)
                .patch(`/api/v1/health-resources/admin/${created._id}/publish`)
                .set('Authorization', `Bearer ${adminTokens.accessToken}`);

            expect(publishAttempt.statusCode).toBe(400);
            expect(publishAttempt.body.success).toBe(false);
            expect(publishAttempt.body.error).toMatch(/Cannot publish unverified health resource/i);

            // Now verify
            await request(app)
                .patch(`/api/v1/health-resources/admin/${created._id}/verify`)
                .set('Authorization', `Bearer ${adminTokens.accessToken}`);

            // Now publish should succeed
            const successPublish = await request(app)
                .patch(`/api/v1/health-resources/admin/${created._id}/publish`)
                .set('Authorization', `Bearer ${adminTokens.accessToken}`);

            expect(successPublish.statusCode).toBe(200);
            expect(successPublish.body.success).toBe(true);
            expect(successPublish.body.data.status).toBe('published');
        });

        it('should archive a resource via DELETE /admin/:id', async () => {
            const created = await HealthResource.create({
                title: 'Discontinued Health Scheme',
                description: 'An older health initiative that has been phased out.',
                category: 'Public Health',
                provider: 'State Health Mission',
                officialUrl: 'https://healthmission.gov.in',
                status: 'published',
                verification: { verified: true, verifiedAt: new Date() }
            });

            const res = await request(app)
                .delete(`/api/v1/health-resources/admin/${created._id}`)
                .set('Authorization', `Bearer ${adminTokens.accessToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('archived');

            const archivedDoc = await HealthResource.findById(created._id);
            expect(archivedDoc.status).toBe('archived');
            expect(archivedDoc.auditTrail.some(a => a.action === 'ARCHIVED')).toBe(true);
        });
    });

    describe('3. Public Visibility & Read APIs (/api/v1/health-resources)', () => {
        beforeEach(async () => {
            // Seed a collection of resources in various states
            await HealthResource.create([
                {
                    title: 'National Tuberculosis Elimination Program',
                    slug: 'national-tb-elimination',
                    description: 'Free diagnostics and anti-TB treatment under the National TB Elimination Program.',
                    category: 'Disease Prevention',
                    provider: 'Central TB Division, MoHFW',
                    officialUrl: 'https://tbcindia.gov.in',
                    region: 'National',
                    status: 'published',
                    verification: { verified: true, verifiedAt: new Date() },
                    isFree: true,
                    tags: ['tb', 'infectious-disease', 'free-treatment'],
                    expiresAt: null
                },
                {
                    title: 'Janani Suraksha Yojana (JSY)',
                    slug: 'janani-suraksha-yojana',
                    description: 'Safe motherhood intervention promoting institutional delivery among poor pregnant women.',
                    category: 'Maternal & Child Health',
                    provider: 'MoHFW',
                    officialUrl: 'https://nhm.gov.in/jsy',
                    region: 'National',
                    status: 'published',
                    verification: { verified: true, verifiedAt: new Date() },
                    isFree: true,
                    tags: ['maternal', 'pregnancy', 'cash-assistance'],
                    expiresAt: null
                },
                {
                    title: 'Seasonal Heatwave Public Advisory',
                    slug: 'seasonal-heatwave-advisory-2025',
                    description: 'Temporary seasonal guidelines for public protection against severe heatwaves.',
                    category: 'Emergency Support',
                    provider: 'NDMA',
                    officialUrl: 'https://ndma.gov.in',
                    status: 'published',
                    verification: { verified: true, verifiedAt: new Date() },
                    expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24) // EXPIRED yesterday!
                },
                {
                    title: 'Future Monsoonal Dengue Advisory',
                    slug: 'future-dengue-advisory',
                    description: 'Vector control and preventive guidelines active through upcoming season.',
                    category: 'Disease Prevention',
                    provider: 'NVBDCP',
                    officialUrl: 'https://nvbdcp.gov.in',
                    status: 'published',
                    verification: { verified: true, verifiedAt: new Date() },
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // Active for 30 days
                },
                {
                    title: 'Draft Mental Health Initiative',
                    slug: 'draft-mental-health',
                    description: 'Work in progress guidelines for student mental health clinics.',
                    category: 'Mental Health',
                    provider: 'MoHFW',
                    officialUrl: 'https://mentalhealth.gov.in',
                    status: 'draft',
                    verification: { verified: false }
                },
                {
                    title: 'Archived Health Camp 2024',
                    slug: 'archived-health-camp-2024',
                    description: 'Completed rural dental and eye checkup camp from last year.',
                    category: 'Medical Camps',
                    provider: 'Red Cross',
                    officialUrl: 'https://redcross.org',
                    status: 'archived',
                    verification: { verified: true, verifiedAt: new Date() }
                }
            ]);
        });

        it('GET /api/v1/health-resources should only return published, verified, and unexpired resources', async () => {
            const res = await request(app).get('/api/v1/health-resources');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            const slugs = res.body.data.map(r => r.slug);

            // Must include active published & verified
            expect(slugs).toContain('national-tb-elimination');
            expect(slugs).toContain('janani-suraksha-yojana');
            expect(slugs).toContain('future-dengue-advisory');

            // Must exclude expired
            expect(slugs).not.toContain('seasonal-heatwave-advisory-2025');

            // Must exclude draft
            expect(slugs).not.toContain('draft-mental-health');

            // Must exclude archived
            expect(slugs).not.toContain('archived-health-camp-2024');

            expect(res.body.total).toBe(3);
        });

        it('GET /api/v1/health-resources should support filtering by category', async () => {
            const res = await request(app)
                .get('/api/v1/health-resources')
                .query({ category: 'Maternal & Child Health' });

            expect(res.statusCode).toBe(200);
            expect(res.body.total).toBe(1);
            expect(res.body.data[0].slug).toBe('janani-suraksha-yojana');
        });

        it('GET /api/v1/health-resources should support search queries', async () => {
            const res = await request(app)
                .get('/api/v1/health-resources')
                .query({ search: 'Tuberculosis' });

            expect(res.statusCode).toBe(200);
            expect(res.body.total).toBe(1);
            expect(res.body.data[0].slug).toBe('national-tb-elimination');
        });

        it('GET /api/v1/health-resources/categories should return distinct public categories', async () => {
            const res = await request(app).get('/api/v1/health-resources/categories');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            const categoryNames = res.body.data.map(c => c.category);

            expect(categoryNames).toContain('Disease Prevention');
            expect(categoryNames).toContain('Maternal & Child Health');
            // Categories of draft/archived/expired must not appear
            expect(categoryNames).not.toContain('Mental Health');
            expect(categoryNames).not.toContain('Medical Camps');
            expect(categoryNames).not.toContain('Emergency Support');
        });

        it('GET /api/v1/health-resources/featured should return featured verified resources', async () => {
            const res = await request(app)
                .get('/api/v1/health-resources/featured')
                .query({ limit: 2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.length).toBeLessThanOrEqual(2);
            expect(res.body.data.every(r => r.status === 'published' && r.verification.verified)).toBe(true);
        });

        it('GET /api/v1/health-resources/:slug should return single published resource', async () => {
            const res = await request(app).get('/api/v1/health-resources/national-tb-elimination');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.title).toBe('National Tuberculosis Elimination Program');
            expect(res.body.data.provider).toBe('Central TB Division, MoHFW');
        });

        it('GET /api/v1/health-resources/:slug should return 404 for draft resource', async () => {
            const res = await request(app).get('/api/v1/health-resources/draft-mental-health');

            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found or currently unavailable/i);
        });

        it('GET /api/v1/health-resources/:slug should return 404 for archived resource', async () => {
            const res = await request(app).get('/api/v1/health-resources/archived-health-camp-2024');

            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it('GET /api/v1/health-resources/:slug should return 404 for expired resource', async () => {
            const res = await request(app).get('/api/v1/health-resources/seasonal-heatwave-advisory-2025');

            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it('GET /api/v1/health-resources/:slug should return 404 for non-existent slug', async () => {
            const res = await request(app).get('/api/v1/health-resources/non-existent-random-slug');

            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });
});
