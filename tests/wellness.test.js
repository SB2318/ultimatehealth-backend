const request = require('supertest');
const app = require('../server');
const WellnessLog = require('../models/WellnessLog');
const WellnessPlan = require('../models/WellnessPlan');
const { createTestUser, getAuthTokensForUser } = require('./testUtils');

// Mock geminiService
jest.mock('../services/geminiService', () => ({
  generateWithKeyRotation: jest.fn().mockResolvedValue(JSON.stringify({
    goals: {
      dailySteps: 8000,
      dailyActiveMinutes: 30,
      dailyCaloriesBurned: 400,
      dailySleepHours: 8,
      dailyBreathingMinutes: 10,
      dailyWaterMl: 2500
    },
    dailyTasks: ['Walk 8000 steps', 'Drink 2.5L water'],
    focusAreas: ['Movement', 'Hydration'],
    weeklyInsight: 'Keep hydrated and keep moving.',
    warnings: []
  }))
}));

describe('Wellness API Tests', () => {
  let user, userTokens;

  beforeAll(async () => {
    user = await createTestUser();
    userTokens = getAuthTokensForUser(user);
  });

  describe('POST /api/wellness/log', () => {
    it('should log wellness metrics for today', async () => {
      const res = await request(app)
        .post('/api/wellness/log')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send({
          date: '2026-07-08',
          metrics: {
            steps: 5000,
            waterMl: 1500
          }
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.steps).toBe(5000);
    });

    it('should update existing metrics for the same date', async () => {
      const res = await request(app)
        .post('/api/wellness/log')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send({
          date: '2026-07-08',
          metrics: {
            waterMl: 2000,
            sleepHours: 7.5
          }
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.metrics.steps).toBe(5000); // Previous metric retained
      expect(res.body.data.metrics.waterMl).toBe(2000); // Updated metric
      expect(res.body.data.metrics.sleepHours).toBe(7.5); // New metric
    });
  });

  describe('GET /api/wellness/weekly', () => {
    it('should return weekly metrics', async () => {
      const res = await request(app)
        .get('/api/wellness/weekly')
        .set('Authorization', `Bearer ${userTokens.accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('POST /api/wellness/plan/generate', () => {
    it('should successfully generate an AI wellness plan', async () => {
      const res = await request(app)
        .post('/api/wellness/plan/generate')
        .set('Authorization', `Bearer ${userTokens.accessToken}`);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.goals.dailySteps).toBe(8000);
      expect(res.body.data.dailyTasks.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/wellness/plan', () => {
    it('should get the latest active plan', async () => {
      const res = await request(app)
        .get('/api/wellness/plan')
        .set('Authorization', `Bearer ${userTokens.accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.goals.dailySteps).toBe(8000);
    });
  });

  describe('GET /api/wellness/plan/history', () => {
    it('should get a paginated history of plans', async () => {
      const res = await request(app)
        .get('/api/wellness/plan/history')
        .set('Authorization', `Bearer ${userTokens.accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination.total).toBe(1);
    });
  });
});
