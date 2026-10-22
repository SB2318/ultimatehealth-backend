const express = require('express');
const glossaryController = require('../controllers/glossaryController');
const { validateBody } = require('../middleware/validator');
const { createGlossarySchema, updateGlossarySchema } = require('../validators/glossary.schema');
const adminAuthenticateToken = require('../middleware/adminAuthenticateToken');

const router = express.Router();

/**
 * @openapi
 * /glossary:
 *   get:
 *     summary: List published glossary terms
 *     description: Retrieve paginated published medical terms with alphabetical and category filters.
 *     tags:
 *       - Glossary
 *     parameters:
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: en-IN
 *       - in: query
 *         name: letter
 *         schema:
 *           type: string
 *         description: First letter for alphabetical browse (e.g. A, B)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category ObjectId
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       '200':
 *         description: Paginated published terms list
 */
router.get('/', glossaryController.listTerms);

/**
 * @openapi
 * /glossary/search:
 *   get:
 *     summary: Full-text search medical glossary
 *     description: Weighted text search across terms, synonyms, descriptions, and definitions.
 *     tags:
 *       - Glossary
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query term
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: en-IN
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       '200':
 *         description: Ranked search results matching query
 *       '400':
 *         description: Search query is required
 */
router.get('/search', glossaryController.searchTerms);

/**
 * @openapi
 * /glossary/{slug}:
 *   get:
 *     summary: Get single glossary term by slug
 *     tags:
 *       - Glossary
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Term details with populated categories and author info
 *       '404':
 *         description: Glossary term not found
 */
router.get('/:slug', glossaryController.getTerm);

/**
 * @openapi
 * /glossary:
 *   post:
 *     summary: Create new glossary term
 *     tags:
 *       - Glossary
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - term
 *               - slug
 *               - definition
 *             properties:
 *               term:
 *                 type: string
 *                 example: "Hypertension"
 *               slug:
 *                 type: string
 *                 example: "hypertension"
 *               language:
 *                 type: string
 *                 default: "en-IN"
 *               synonyms:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["High blood pressure", "HTN"]
 *               shortDescription:
 *                 type: string
 *                 example: "A condition where blood pressure remains consistently high."
 *               definition:
 *                 type: string
 *                 example: "Hypertension is a chronic medical condition in which systemic arterial pressure is elevated."
 *     responses:
 *       '201':
 *         description: Glossary term created successfully
 */
router.post('/', adminAuthenticateToken, validateBody(createGlossarySchema), glossaryController.createTerm);
router.put('/:id', adminAuthenticateToken, validateBody(updateGlossarySchema), glossaryController.updateTerm);
router.delete('/:id', adminAuthenticateToken, glossaryController.deleteTerm);

router.get('/admin/review-queue', adminAuthenticateToken, glossaryController.getUnassignedGlossaryQueue);
router.get('/admin/my-reviews/in-progress', adminAuthenticateToken, glossaryController.getReviewerInProgressGlossary);
router.get('/admin/my-reviews/completed', adminAuthenticateToken, glossaryController.getReviewerCompletedGlossary);
router.post('/admin/:id/pick', adminAuthenticateToken, glossaryController.pickGlossaryTerm);
router.post('/admin/:id/approve', adminAuthenticateToken, glossaryController.approveGlossaryTerm);
router.post('/admin/:id/feedback', adminAuthenticateToken, glossaryController.sendGlossaryFeedback);
router.post('/admin/:id/reject', adminAuthenticateToken, glossaryController.rejectGlossaryTerm);

module.exports = router;
