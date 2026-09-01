const request = require('supertest');
const app = require('../server');
const User = require('../models/UserModel');
const WellnessLog = require('../models/WellnessLog');
const { createTestUser, getAuthTokensForUser } = require('./testUtils');

describe('User Account Deletion Tests', () => {
  let user1, user1Tokens, user2, user2Tokens;

  beforeAll(async () => {
    user1 = await createTestUser({ email: 'delete1@test.com' });
    user1Tokens = getAuthTokensForUser(user1);
    
    user2 = await createTestUser({ email: 'delete2@test.com' });
    user2Tokens = getAuthTokensForUser(user2);
  });

  describe('POST /api/user/deactivate (Soft Delete)', () => {
    it('should deactivate the account without deleting data', async () => {
      // 1. Deactivate
      const res = await request(app)
        .post('/api/user/deactivate')
        .set('Authorization', `Bearer ${user1Tokens.accessToken}`)
        .send({ password: 'Password123!' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // 2. Check DB
      const checkUser = await User.findById(user1._id);
      expect(checkUser).toBeDefined();
      expect(checkUser.isDeactivated).toBe(true);
      expect(checkUser.deactivatedAt).toBeDefined();
    });
  });

  describe('POST /api/user/delete (Hard Delete)', () => {
    it('should permanently delete the user and all associated data', async () => {
      // 1. Create some associated data for user2
      await WellnessLog.create({
        userId: user2._id,
        date: '2026-08-01',
        metrics: { steps: 2000 }
      });

      // 2. Hard delete
      const res = await request(app)
        .post('/api/user/delete')
        .set('Authorization', `Bearer ${user2Tokens.accessToken}`)
        .send({ password: 'Password123!' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // 3. Check DB - User should be gone
      const checkUser = await User.findById(user2._id);
      expect(checkUser).toBeNull();

      // 4. Check DB - Wellness data should be gone
      const checkLogs = await WellnessLog.find({ userId: user2._id });
      expect(checkLogs.length).toBe(0);
    });
  });
});
