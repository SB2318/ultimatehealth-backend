const mongoose = require('mongoose');
const User = require('../models/UserModel');
const Admin = require('../models/admin/adminModel');
const { generateAccessToken, generateRefreshToken } = require('../services/security/tokenService');
const { generateHashPassword } = require('../services/security/encryptService');

const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    user_name: 'Test User',
    user_handle: `testuser_${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    password: await generateHashPassword('Password123!'),
    isVerified: true,
    isDoctor: false,
    ...overrides
  };
  
  const user = await User.create(defaultUser);
  return user;
};

const createTestAdmin = async (overrides = {}) => {
  const defaultAdmin = {
    name: 'Test Admin',
    email: `admin${Date.now()}@example.com`,
    password: await generateHashPassword('AdminPass123!'),
    permissions: ['ALL'],
    ...overrides
  };
  
  const admin = await Admin.create(defaultAdmin);
  return admin;
};

const getAuthTokensForUser = (user) => {
  const payload = { userId: user._id, role: 'user' };
  return {
    accessToken: generateAccessToken(payload, '15m'),
    refreshToken: generateRefreshToken(payload, '7d')
  };
};

const getAuthTokensForAdmin = (admin) => {
  const payload = { userId: admin._id, role: 'admin' };
  return {
    accessToken: generateAccessToken(payload, '15m'),
    refreshToken: generateRefreshToken(payload, '7d')
  };
};

module.exports = {
  createTestUser,
  createTestAdmin,
  getAuthTokensForUser,
  getAuthTokensForAdmin
};
