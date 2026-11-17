const express = require('express');
const router = express.Router();
const { subscribeNewsletter } = require('../controllers/newsletterController');
const { newsletterLimiter } = require('../middleware/ratelimit');

// Subscribe to newsletter
router.post('/newsletter/subscribe', newsletterLimiter, subscribeNewsletter);

module.exports = router;
