const { HTTP_STATUS, ERROR_CODES } = require("../../constants/errorConstants");
const Article = require("../../models/Articles");
const ReadingHistory = require("../../models/events/readHistorySchema");
const { throwError } = require("../../utils/throwError");
const { findUserById } = require("./userService");
const { statusEnum } = require("../../utils/StatusEnum");

const findArticleById = async (articleId) => {
  if (!Number.isSafeInteger(articleId) || articleId <= 0) {
    throwError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.INVALID_INPUT,
      "Article ID must be a positive integer within safe range"
    );
  }
  return Article.findById(Number(articleId)).lean();
}

const getArticleContributors = async (articleId) => {

  const article = await
    Article.findById(Number(articleId))
      .populate({
        path: "contributors",
        select: "user_id user_name followers Profile_image",
        match: {
          isBannedUser: false,
          isBlockUser: false
        }
      }).
      exec();

  if (!article || article.is_removed || article.status === statusEnum.DELETED) {
    return null;
  }

  if (article.contributors) {
    article.contributors = article.contributors.filter(user => user !== null);
  }

  return article.contributors || [];
}

const getReadingHistory = async (userId, limit, skip, page) => {

  const user = await findUserById(userId);

  if (!user) {
    throwError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.INVALID_INPUT,
      "User Not found"
    );
  }

  const historyRecords = await
    ReadingHistory.find({ userId }).
      sort({ dateRead: -1 }).
      skip(skip).
      limit(limit)
      .populate({
        path: 'articleId',
        match: {
          status: { $ne: statusEnum.DELETED }
        },
        populate: [
          {
            path: 'tags'
          },
          {
            path: 'mentionedUsers',
            select: 'user_handle user_name Profile_image',
            match: {
              isBlockUser: false,
              isBannedUser: false
            }
          },
          {
            path: 'likedUsers',
            select: 'Profile_image user_name user_handle',
            match: {
              isBlockUser: false,
              isBannedUser: false
            }
          },
          {
            path: 'authorId',
            select: 'Profile_image user_name user_handle',
            match: {
              isBlockUser: false,
              isBannedUser: false
            }
          }
        ]
      })
      .lean()
      .exec();

  const formattedArticles = historyRecords
    .filter(record => record.articleId)
    .map(record => {
      const articleData = record.articleId.toObject();
      return {
        ...articleData,
        dateRead: record.dateRead
      };
    });
  if (Number(page) === 1) {
    const totalArticles = await ReadingHistory.countDocuments({ userId });
    const totalPages = Math.ceil(totalArticles / Number(limit));
    return { articles: formattedArticles, totalPages };
  }


  return { articles: formattedArticles };

}

const getRelatedArticles = async (articleId, limit = 10, excludeIds = []) => {
  const currentId = Number(articleId);

  const currentArticle = await Article.findById(currentId).lean();
  if (!currentArticle) {
    throwError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      "Article not found"
    );
  }

  const targetTags = currentArticle.tags || [];
  const searchKeywords = (currentArticle.title || "").replace(/[^\w\s]/gi, " ").trim();


  const allExcludedIds = [currentId, ...excludeIds.map(Number)].filter(Boolean);

  //  Base Match Filter
  const baseMatch = {
    _id: { $nin: allExcludedIds },
    status: statusEnum.PUBLISHED || "published",
    is_removed: false,
    language: currentArticle.language || "en-In",
  };

  // Conditions for relevance: matching tags OR title keyword similarity
  const orConditions = [];
  if (targetTags.length > 0) {
    orConditions.push({ tags: { $in: targetTags } });
  }
  if (searchKeywords) {
    const keywords = (searchKeywords || "").split(/\s+/).filter(w => w.length > 2).slice(0, 5);
    const escapedKeywords = keywords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    orConditions.push({ title: { $regex: escapedKeywords || searchKeywords, $options: 'i' } });
  }

  const matchFilter = orConditions.length > 0
    ? { ...baseMatch, $or: orConditions }
    : baseMatch;

  const pipeline = [
    { $match: matchFilter },
    {
      $addFields: {
        tagOverlapCount: targetTags.length > 0
          ? { $size: { $setIntersection: ["$tags", targetTags] } }
          : 0,
        textScore: searchKeywords ? 1.0 : 0,
        engagementBoost: {
          $ln: {
            $add: [
              { $ifNull: ["$viewCount", 0] },
              { $multiply: [{ $ifNull: ["$likeCount", 0] }, 2] },
              1
            ]
          }
        }
      }
    },
    {
      $addFields: {
        relevanceScore: {
          $add: [
            { $multiply: ["$tagOverlapCount", 5.0] }, // Tags: 50% weight
            { $multiply: ["$textScore", 2.0] },       // Text: 35% weight
            { $multiply: ["$engagementBoost", 0.5] }  // Popularity: 15% weight
          ]
        }
      }
    },
    { $sort: { relevanceScore: -1 } },
    { $limit: Number(limit) },
    // Populate Author info
    {
      $lookup: {
        from: "users",
        localField: "authorId",
        foreignField: "_id",
        as: "author",
        pipeline: [
          { $project: { user_name: 1, user_handle: 1, Profile_image: 1 } }
        ]
      }
    },
    // Populate Tags info
    {
      $lookup: {
        from: "articletags",
        localField: "tags",
        foreignField: "_id",
        as: "tagsData",
        pipeline: [
          { $project: { id: 1, name: 1 } }
        ]
      }
    },
    {
      $project: {
        _id: 1,
        title: 1,
        summary: 1,
        description: 1,
        imageUtils: 1,
        viewCount: 1,
        likeCount: 1,
        publishedDate: 1,
        language: 1,
        author: { $arrayElemAt: ["$author", 0] },
        tags: "$tagsData",
        relevanceScore: 1
      }
    }
  ];

  let related = await Article.aggregate(pipeline);

  if (related.length < limit) {
    const existingIds = [...allExcludedIds, ...related.map((a) => a._id)];
    const fallbackCount = limit - related.length;

    const fallbackArticles = await Article.find({
      _id: { $nin: existingIds },
      status: statusEnum.PUBLISHED || "published",
      is_removed: false,
      language: currentArticle.language || "English",
    })
      .sort({ viewCount: -1, publishedDate: -1 })
      .limit(fallbackCount)
      .populate("authorId", "user_name user_handle Profile_image")
      .populate("tags", "id name")
      .lean();

    const formattedFallback = fallbackArticles.map((a) => ({
      _id: a._id,
      title: a.title,
      summary: a.summary,
      description: a.description,
      imageUtils: a.imageUtils,
      viewCount: a.viewCount,
      likeCount: a.likeCount,
      publishedDate: a.publishedDate,
      language: a.language,
      author: a.authorId,
      tags: a.tags,
      relevanceScore: 0
    }));

    related = [...related, ...formattedFallback];
  }

  return related;
};

module.exports = {
  findArticleById,
  getArticleContributors,
  getReadingHistory,
  getRelatedArticles
}