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

module.exports = {
  findArticleById,
  getArticleContributors,
  getReadingHistory
}