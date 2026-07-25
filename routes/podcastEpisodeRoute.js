const express = require('express');
const router = express.Router();

const authenticateToken = require('../middleware/authentcatetoken');
const {
    createPodcastEpisode,
    getMyPodcastEpisodes,
    getPodcastEpisodeById,
    updatePodcastEpisode,
    deletePodcastEpisode
} = require('../controllers/podcastEpisodeController');

/**
 * @swagger
 * /podcast-episodes:
 *   post:
 *     tags:
 *       - Podcast Episodes
 *     summary: Create a podcast episode
 *     description: Creates a new podcast episode container for the authenticated user. New episodes start with podcasts_count = 0.
 *     operationId: createPodcastEpisode
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Mental Wellness"
 *               description:
 *                 type: string
 *                 example: "Episodes about mindfulness and mental health"
 *     responses:
 *       '201':
 *         description: Episode created successfully
 *       '400':
 *         description: Episode name is required
 *       '401':
 *         description: Unauthorized - Missing or invalid token
 *       '500':
 *         description: Internal server error
 */
router.post('/podcast-episodes', authenticateToken, createPodcastEpisode);

/**
 * @swagger
 * /podcast-episodes:
 *   get:
 *     tags:
 *       - Podcast Episodes
 *     summary: Get my podcast episodes
 *     description: Returns all episodes created by the authenticated user, sorted by most recently updated.
 *     operationId: getMyPodcastEpisodes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of episodes successfully retrieved
 *       '401':
 *         description: Unauthorized - Missing or invalid token
 *       '500':
 *         description: Internal server error
 */
router.get('/podcast-episodes', authenticateToken, getMyPodcastEpisodes);

/**
 * @swagger
 * /podcast-episodes/{episodeId}:
 *   get:
 *     tags:
 *       - Podcast Episodes
 *     summary: Get episode details
 *     description: Retrieves a single podcast episode by its ID.
 *     operationId: getPodcastEpisodeById
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: episodeId
 *         required: true
 *         schema:
 *           type: string
 *         example: "64f8b94a12e4b6fabc123456"
 *     responses:
 *       '200':
 *         description: Episode fetched successfully
 *       '400':
 *         description: Invalid episode id
 *       '401':
 *         description: Unauthorized - Missing or invalid token
 *       '404':
 *         description: Episode not found
 *       '500':
 *         description: Internal server error
 */
router.get('/podcast-episodes/:episodeId', authenticateToken, getPodcastEpisodeById);

/**
 * @swagger
 * /podcast-episodes/{episodeId}:
 *   patch:
 *     tags:
 *       - Podcast Episodes
 *     summary: Update a podcast episode
 *     description: Updates the name and/or description of an episode. Only the owning user may update it.
 *     operationId: updatePodcastEpisode
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: episodeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Episode updated successfully
 *       '400':
 *         description: Invalid episode id or nothing to update
 *       '401':
 *         description: Unauthorized - Missing or invalid token
 *       '403':
 *         description: Not authorized to update this episode
 *       '404':
 *         description: Episode not found
 *       '500':
 *         description: Internal server error
 */
router.patch('/podcast-episodes/:episodeId', authenticateToken, updatePodcastEpisode);

/**
 * @swagger
 * /podcast-episodes/{episodeId}:
 *   delete:
 *     tags:
 *       - Podcast Episodes
 *     summary: Delete a podcast episode
 *     description: Deletes an episode by its ID. Only the owning user may delete it.
 *     operationId: deletePodcastEpisode
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: episodeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Episode deleted successfully
 *       '400':
 *         description: Invalid episode id
 *       '401':
 *         description: Unauthorized - Missing or invalid token
 *       '403':
 *         description: Not authorized to delete this episode
 *       '404':
 *         description: Episode not found
 *       '500':
 *         description: Internal server error
 */
router.delete('/podcast-episodes/:episodeId', authenticateToken, deletePodcastEpisode);

module.exports = router;
