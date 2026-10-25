const Article = require("../models/Articles");
const Podcast = require("../models/Podcast");
const PlayList = require("../models/playlistSchema");
const PodcastEpisode = require("../models/PodcastEpisode");
const EditRequest = require("../models/admin/articleEditRequestModel");
const Glossary = require("../models/Glossary");
const Admin = require("../models/admin/adminModel");
const mongoose = require("mongoose");

/**
 * Helper to check whether an admin user has Super Admin privileges
 */
const checkIsSuperAdmin = async (userId) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return false;
  try {
    const admin = await Admin.findById(userId).select("isSuperAdmin role");
    return Boolean(admin && (admin.isSuperAdmin || admin.role === "Super Admin"));
  } catch {
    return false;
  }
};

/**
 * 1. Article Ownership:
 * Only original Author OR assigned Reviewer/Moderator OR SuperAdmin can update/delete.
 */
const checkArticleOwnership = async (req, res, next) => {
  const articleId = req.params.id || req.body.articleId || req.body.id;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!articleId) {
    return res.status(400).json({ message: "Article ID is required" });
  }

  try {
    const article = !isNaN(Number(articleId))
      ? await Article.findById(Number(articleId))
      : await Article.findOne({ pb_recordId: articleId });

    if (!article || article.is_removed) {
      return res.status(404).json({ message: "Article not found" });
    }

    const isAuthor = article.authorId && article.authorId.toString() === userId.toString();
    const isSuper = await checkIsSuperAdmin(userId);

    if (isAuthor || isSuper) {
      req.article = article;
      return next();
    }

    return res.status(403).json({
      message: "Forbidden: You are not authorized to modify this article",
    });
  } catch (error) {
    return res.status(500).json({ message: "Error verifying article ownership", error: error.message });
  }
};

/**
 * 2. Podcast Ownership:
 * Only creator (user_id) OR assigned Moderator (admin_id) OR SuperAdmin can update/delete.
 */
const checkPodcastOwnership = async (req, res, next) => {
  const podcastId = req.params.podcastId || req.body.podcastId || req.query.podcastId;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!podcastId) {
    return res.status(400).json({ error: "Invalid request: podcastId is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(podcastId)) {
    return res.status(404).json({ error: "Podcast not found" });
  }

  try {
    const podcast = await Podcast.findById(podcastId);

    if (!podcast || podcast.is_removed) {
      return res.status(404).json({ error: "Podcast not found" });
    }

    const isCreator = podcast.user_id && podcast.user_id.toString() === userId.toString();
    const isAssignedModerator = podcast.admin_id && podcast.admin_id.toString() === userId.toString();
    const isSuper = await checkIsSuperAdmin(userId);

    if (isCreator || isAssignedModerator || isSuper) {
      req.podcast = podcast;
      return next();
    }

    return res.status(403).json({
      error: "Forbidden: Only the creator or assigned moderator can modify this podcast",
    });
  } catch (error) {
    return res.status(500).json({ error: "Error verifying podcast ownership", details: error.message });
  }
};

/**
 * 3. Playlist Ownership:
 * Only creator (user) OR SuperAdmin can update/delete.
 */
const checkPlaylistOwnership = async (req, res, next) => {
  const playlistId = req.params.playlistId || req.body.playlistId || req.query.playlistId;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!playlistId) {
    return res.status(400).json({ error: "Invalid request: playlistId is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(playlistId)) {
    return res.status(404).json({ error: "Playlist not found" });
  }

  try {
    const playlist = await PlayList.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const isOwner = playlist.user && playlist.user.toString() === userId.toString();
    const isSuper = await checkIsSuperAdmin(userId);

    if (isOwner || isSuper) {
      req.playlist = playlist;
      return next();
    }

    return res.status(403).json({
      error: "Forbidden: You are not authorized to modify this playlist",
    });
  } catch (error) {
    return res.status(500).json({ error: "Error verifying playlist ownership", details: error.message });
  }
};

/**
 * 4. Podcast Episode Ownership:
 * Only creator (user_id) OR SuperAdmin can update/delete episode.
 */
const checkPodcastEpisodeOwnership = async (req, res, next) => {
  const episodeId = req.params.episodeId || req.body.episodeId;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!episodeId) {
    return res.status(400).json({ message: "Episode ID is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(episodeId)) {
    return res.status(404).json({ message: "Episode not found" });
  }

  try {
    const episode = await PodcastEpisode.findById(episodeId);

    if (!episode) {
      return res.status(404).json({ message: "Episode not found" });
    }

    const isOwner = episode.user_id && episode.user_id.toString() === userId.toString();
    const isSuper = await checkIsSuperAdmin(userId);

    if (isOwner || isSuper) {
      req.podcastEpisode = episode;
      return next();
    }

    return res.status(403).json({
      message: "Forbidden: You are not authorized to modify this episode",
    });
  } catch (error) {
    return res.status(500).json({ message: "Error verifying episode ownership", error: error.message });
  }
};

/**
 * 5. Article Improvement Contributor Ownership:
 * Only currently assigned contributor (user_id) can submit improvements on their own request.
 */
const checkImprovementContributorOwnership = async (req, res, next) => {
  const requestId = req.body.requestId || req.params.requestId || req.params.reqid;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!requestId) {
    return res.status(400).json({ message: "Request ID is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return res.status(404).json({ message: "Edit request not found" });
  }

  try {
    const editRequest = await EditRequest.findById(requestId);

    if (!editRequest) {
      return res.status(404).json({ message: "Edit request not found" });
    }

    const isAssignedContributor =
      editRequest.user_id && editRequest.user_id.toString() === userId.toString();

    if (isAssignedContributor) {
      req.editRequest = editRequest;
      return next();
    }

    return res.status(403).json({
      message: "Forbidden: Only the assigned contributor can submit improvements for this request",
    });
  } catch (error) {
    return res.status(500).json({ message: "Error verifying contributor ownership", error: error.message });
  }
};

/**
 * 6. Article Improvement Reviewer Ownership:
 * Only currently assigned moderator (reviewer_id) OR SuperAdmin can review, discard, or publish.
 */
const checkImprovementReviewerOwnership = async (req, res, next) => {
  const requestId = req.body.requestId || req.params.requestId || req.params.reqid;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!requestId) {
    return res.status(400).json({ message: "Request ID is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return res.status(404).json({ message: "Edit request not found" });
  }

  try {
    const editRequest = await EditRequest.findById(requestId);

    if (!editRequest) {
      return res.status(404).json({ message: "Edit request not found" });
    }

    const isAssignedReviewer =
      editRequest.reviewer_id && editRequest.reviewer_id.toString() === userId.toString();
    const isSuper = await checkIsSuperAdmin(userId);

    if (isAssignedReviewer || isSuper) {
      req.editRequest = editRequest;
      return next();
    }

    return res.status(403).json({
      message: "Forbidden: Only the assigned moderator can review or publish this improvement",
    });
  } catch (error) {
    return res.status(500).json({ message: "Error verifying reviewer ownership", error: error.message });
  }
};

/**
 * 7. Glossary Ownership:
 * Only author (authorId) OR assigned reviewer (reviewerId) OR SuperAdmin can update/delete.
 */
const checkGlossaryOwnership = async (req, res, next) => {
  const id = req.params.id || req.body.id;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!id) {
    return res.status(400).json({ message: "Glossary term ID is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Glossary term not found" });
  }

  try {
    const term = await Glossary.findById(id);

    if (!term || term.is_removed) {
      return res.status(404).json({ message: "Glossary term not found" });
    }

    const isAuthor = term.authorId && term.authorId.toString() === userId.toString();
    const isAssignedReviewer = term.reviewerId && term.reviewerId.toString() === userId.toString();
    const isSuper = await checkIsSuperAdmin(userId);

    if (isAuthor || isAssignedReviewer || isSuper) {
      req.glossaryTerm = term;
      return next();
    }

    return res.status(403).json({
      message: "Forbidden: Only the author or assigned moderator can modify this glossary term",
    });
  } catch (error) {
    return res.status(500).json({ message: "Error verifying glossary ownership", error: error.message });
  }
};

module.exports = {
  checkArticleOwnership,
  checkPodcastOwnership,
  checkPlaylistOwnership,
  checkPodcastEpisodeOwnership,
  checkImprovementContributorOwnership,
  checkImprovementReviewerOwnership,
  checkGlossaryOwnership,
};
