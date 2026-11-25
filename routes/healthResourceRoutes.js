const express = require('express');
const adminAuthenticateToken = require('../middleware/adminAuthenticateToken');
const {
    getPublicHealthResources,
    getPublicCategories,
    getFeaturedHealthResources,
    getPublicHealthResourceBySlug,
    createAdminHealthResource,
    updateAdminHealthResource,
    deleteAdminHealthResource,
    verifyAdminHealthResource,
    publishAdminHealthResource
} = require('../controllers/healthResourceController');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Health Resources
 *     description: Verified public-health resources, government healthcare schemes, and initiatives
 */

/**
 * @openapi
 * /v1/health-resources/categories:
 *   get:
 *     summary: Get distinct categories of verified and published health resources
 *     tags:
 *       - Health Resources
 *     responses:
 *       200:
 *         description: Successfully retrieved public categories
 */
router.get('/categories', getPublicCategories);

/**
 * @openapi
 * /v1/health-resources/featured:
 *   get:
 *     summary: Get featured verified and published health resources
 *     tags:
 *       - Health Resources
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Successfully retrieved featured resources
 */
router.get('/featured', getFeaturedHealthResources);

/**
 * @openapi
 * /v1/health-resources/admin:
 *   post:
 *     summary: Create a new health resource (Admin only)
 *     tags:
 *       - Health Resources
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - category
 *               - provider
 *               - officialUrl
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               provider:
 *                 type: string
 *               officialUrl:
 *                 type: string
 *               region:
 *                 type: string
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *               eligibility:
 *                 type: string
 *               isFree:
 *                 type: boolean
 *               sourceType:
 *                 type: string
 *                 enum: [government, ngo, public-health-org, international, other]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Health resource created successfully
 *       400:
 *         description: Validation error or unverified publishing attempt
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/admin', adminAuthenticateToken, createAdminHealthResource);

/**
 * @openapi
 * /v1/health-resources/admin/{id}:
 *   patch:
 *     summary: Update an existing health resource (Admin only)
 *     tags:
 *       - Health Resources
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Health resource updated successfully
 */
router.patch('/admin/:id', adminAuthenticateToken, updateAdminHealthResource);

/**
 * @openapi
 * /v1/health-resources/admin/{id}:
 *   delete:
 *     summary: Archive a health resource (Admin only)
 *     tags:
 *       - Health Resources
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Health resource archived successfully
 */
router.delete('/admin/:id', adminAuthenticateToken, deleteAdminHealthResource);

/**
 * @openapi
 * /v1/health-resources/admin/{id}/verify:
 *   patch:
 *     summary: Mark a health resource as verified (Admin only)
 *     tags:
 *       - Health Resources
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Health resource verified successfully
 */
router.patch('/admin/:id/verify', adminAuthenticateToken, verifyAdminHealthResource);

/**
 * @openapi
 * /v1/health-resources/admin/{id}/publish:
 *   patch:
 *     summary: Publish a verified health resource (Admin only)
 *     tags:
 *       - Health Resources
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Health resource published successfully
 *       400:
 *         description: Cannot publish unverified resource
 */
router.patch('/admin/:id/publish', adminAuthenticateToken, publishAdminHealthResource);

/**
 * @openapi
 * /v1/health-resources:
 *   get:
 *     summary: Browse verified and published public health resources
 *     tags:
 *       - Health Resources
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *       - in: query
 *         name: isFree
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Paginated public health resources list
 */
router.get('/', getPublicHealthResources);

/**
 * @openapi
 * /v1/health-resources/{slug}:
 *   get:
 *     summary: Get single public health resource by slug
 *     tags:
 *       - Health Resources
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Health resource details
 *       404:
 *         description: Resource not found or unverified/archived/expired
 */
router.get('/:slug', getPublicHealthResourceBySlug);

module.exports = router;
