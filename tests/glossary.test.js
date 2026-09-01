const request = require('supertest');
const app = require('../server');
const GlossaryTerm = require('../models/GlossaryTerm');
const { createTestAdmin, getAuthTokensForAdmin } = require('./testUtils');

describe('Glossary API Tests', () => {
  let admin, adminTokens, termId;

  beforeAll(async () => {
    admin = await createTestAdmin();
    adminTokens = getAuthTokensForAdmin(admin);
  });

  describe('POST /api/glossary', () => {
    it('should allow admin to create a new term', async () => {
      const res = await request(app)
        .post('/api/glossary')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send({
          term: 'Hypertension',
          definition: 'High blood pressure.',
          category: 'Conditions',
          source: 'WHO',
          relatedTerms: ['Blood Pressure']
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('hypertension');
      termId = res.body.data._id;
    });

    it('should reject unauthorized users', async () => {
      const res = await request(app)
        .post('/api/glossary')
        .send({
          term: 'Hypotension',
          definition: 'Low blood pressure.'
        });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/glossary', () => {
    it('should list all glossary terms', async () => {
      const res = await request(app).get('/api/glossary');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].term).toBe('Hypertension');
    });
  });

  describe('GET /api/glossary/search', () => {
    it('should search for terms', async () => {
      const res = await request(app).get('/api/glossary/search?q=hypert');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/glossary/:slug', () => {
    it('should retrieve a single term by slug', async () => {
      const res = await request(app).get('/api/glossary/hypertension');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.term).toBe('Hypertension');
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app).get('/api/glossary/non-existent-term');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/glossary/:id', () => {
    it('should allow admin to update term', async () => {
      const res = await request(app)
        .put(`/api/glossary/${termId}`)
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send({
          definition: 'A condition in which the blood pressure in the arteries is persistently elevated.'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.definition).toMatch(/elevated/);
    });
  });

  describe('DELETE /api/glossary/:id', () => {
    it('should allow admin to delete term', async () => {
      const res = await request(app)
        .delete(`/api/glossary/${termId}`)
        .set('Authorization', `Bearer ${adminTokens.accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const checkRes = await request(app).get('/api/glossary/hypertension');
      expect(checkRes.statusCode).toBe(404);
    });
  });
});
