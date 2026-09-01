const { sendPushNotification } = require('../../controllers/notifications/notificationHelper');
const { sendNewArticleEmail } = require('../../controllers/emailservice');
const Notification = require('../../models/notificationSchema');
const Article = require('../../models/Articles');
const User = require('../../models/UserModel');
const Admin = require('../../models/admin/adminModel');



const savePostLikeNotification = async ({ userId, articleId, podcastId, articleRecordId, title, message, timestamp }) => {
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) return null;

    const notification = new Notification({
        userId: user._id,
        adminId: null,
        articleId,
        podcastId,
        articleRecordId,
        revisonId: null,
        commentId: null,
        type: podcastId ? 'podcastLike' : 'articleLike',
        title,
        message,
        read: false,
        timestamp: timestamp || Date.now()
    });
    await notification.save();
    return user.fcmToken;
};

const saveCommentNotification = async ({ articleId, podcastId, commentId, requestId, articleRecordId, userId, adminId, title, message, timestamp }) => {
    let user;
    if (adminId) {
        user = await Admin.findById(adminId);
    } else {
        user = await User.findById(userId);
    }
    if (!user || !user.fcmToken) return null;

    const notification = new Notification({
        userId: userId ? user._id : null,
        adminId: adminId ? user._id : null,
        articleId,
        podcastId,
        articleRecordId,
        revisonId: requestId,
        commentId,
        type: podcastId ? 'podcastComment' : requestId ? 'editRequestComment' : 'articleComment',
        title,
        message,
        read: false,
        timestamp: timestamp || Date.now()
    });
    await notification.save();
    return user.fcmToken;
};

const saveCommentLikeNotification = async ({ userId, articleId, podcastId, articleRecordId, commentId, title, message, timestamp }) => {
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) return null;

    const notification = new Notification({
        userId: user._id,
        articleId,
        podcastId,
        articleRecordId,
        revisonId: null,
        commentId,
        type: 'commentLike',
        title,
        message,
        read: false,
        timestamp: timestamp || Date.now()
    });
    await notification.save();
    return user.fcmToken;
};

const saveUserFollowNotification = async ({ userId, message, timestamp }) => {
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) return null;

    const notification = new Notification({
        userId: user._id,
        articleId: null,
        podcastId: null,
        articleRecordId: null,
        revisonId: null,
        commentId: null,
        type: 'userFollow',
        title: message.title,
        message: message.message,
        read: false,
        timestamp: timestamp || Date.now()
    });
    await notification.save();
    return { fcmToken: user.fcmToken, payload: message };
};

// Saves notification for each follower. Returns array of {fcmToken, title, message} objects.
const saveRepostNotifications = async ({ userId, authorId, articleId, articleRecordId, title, message, authorTitle, authorMessage, timestamp }) => {
    const results = [];

    const user = await User.findById(userId).populate('followers').exec();
    if (user) {
        for (const u of user.followers) {
            if (u.fcmToken) {
                const notification = new Notification({
                    userId: u._id,
                    articleId,
                    podcastId: null,
                    articleRecordId,
                    revisonId: null,
                    commentId: null,
                    type: 'articleRepost',
                    title,
                    message,
                    read: false,
                    timestamp: timestamp || Date.now()
                });
                await notification.save();
                results.push({ fcmToken: u.fcmToken, title, message });
            }
        }
    }

    const author = await User.findById(authorId);
    if (author && author.fcmToken) {
        const notification = new Notification({
            userId: author._id,
            articleId,
            podcastId: null,
            articleRecordId,
            revisonId: null,
            commentId: null,
            type: 'articleRepost',
            title: authorTitle,
            message: authorMessage,
            read: false,
            timestamp: timestamp || Date.now()
        });
        await notification.save();
        results.push({ fcmToken: author.fcmToken, title: authorTitle, message: authorMessage });
    }

    return results;
};

// Saves notification for each mentioned user. Returns array of {fcmToken, title, message} objects.
const saveMentionNotifications = async ({ mentionedUsers, articleId, podcastId, requestId, articleRecordId, commentId, title, message, timestamp }) => {
    const results = [];

    for (const uid of mentionedUsers) {
        const user = await User.findById(uid);
        if (user && user.fcmToken) {
            const notification = new Notification({
                userId: user._id,
                articleId,
                podcastId,
                articleRecordId,
                revisonId: requestId,
                commentId,
                type: podcastId ? 'podcastCommentMention' : 'articleCommentMention',
                title,
                message,
                read: false,
                timestamp: timestamp || Date.now()
            });
            await notification.save();
            results.push({ fcmToken: user.fcmToken, title, message });
        }
    }

    return results;
};

const saveArticleReviewNotification = async ({ userId, articleId, articleRecordId, requestId, title, message, timestamp }) => {
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) return null;

    const notification = new Notification({
        userId: user._id,
        articleId,
        articleRecordId,
        revisonId: requestId,
        type: requestId ? 'articleRevisionReview' : 'articleReview',
        title,
        message,
        read: false,
        timestamp: timestamp || Date.now()
    });
    await notification.save();
    return user.fcmToken;
};

const savePodcastReviewNotification = async ({ userId, podcastId, title, message, timestamp }) => {
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) return null;

    const notification = new Notification({
        userId: user._id,
        articleId: null,
        articleRecordId: null,
        revisonId: null,
        podcastId,
        type: 'podcastReview',
        title,
        message,
        read: false,
        timestamp: timestamp || Date.now()
    });
    await notification.save();
    return user.fcmToken;
};

const saveArticleSubmitAdminNotification = async ({ adminId, articleId, articleRecordId, requestId, title, message, timestamp }) => {
    const admin = await Admin.findById(adminId);
    if (!admin || !admin.fcmToken) return null;

    const notification = new Notification({
        adminId: admin._id,
        articleId,
        articleRecordId,
        revisonId: requestId,
        type: requestId ? 'revisionSubmitToAdmin' : 'articleSubmitToAdmin',
        title,
        message,
        read: false,
        timestamp: timestamp || Date.now()
    });
    await notification.save();
    return admin.fcmToken;
};



// Returns array of {fcmToken, title, message} for POST_PUBLISHED_BROADCAST (followers + author)
const savePostPublishedNotifications = async ({ userId, articleId, podcastId, articleRecordId, requestId, title, message, authorTitle, authorMessage, timestamp }) => {
    const results = [];

    const user = await User.findById(userId).populate('followers').exec();
    if (!user) return results;

    for (const u of user.followers) {
        if (u.fcmToken) {
            const notification = new Notification({
                userId: u._id,
                adminId: null,
                articleId,
                podcastId,
                articleRecordId,
                revisonId: requestId,
                commentId: null,
                type: podcastId ? 'podcast' : requestId ? 'editRequest' : 'article',
                title,
                message,
                read: false,
                timestamp: timestamp || Date.now()
            });
            await notification.save();
            results.push({ fcmToken: u.fcmToken, title, message });
        }
    }

    if (user.fcmToken) {
        const notification = new Notification({
            userId: user._id,
            adminId: null,
            articleId,
            podcastId,
            articleRecordId,
            revisonId: requestId,
            commentId: null,
            type: podcastId ? 'podcast' : requestId ? 'editRequest' : 'article',
            title: authorTitle,
            message: authorMessage,
            read: false,
            timestamp: timestamp || Date.now()
        });
        await notification.save();
        results.push({ fcmToken: user.fcmToken, title: authorTitle, message: authorMessage });
    }

    return results;
};

// Handles the full NEW_ARTICLE_BROADCAST loop:
// fetches article + eligible users, saves a Notification per user, returns array of {email, fcmToken, title, message}
const broadcastNewArticleNotifications = async ({ articleId, timestamp }) => {
    const results = [];

    const article = await Article.findById(articleId).populate('tags authorId').exec();
    if (!article || article.is_removed) return results;

    const isHealthCategory = article.tags.some(tag => tag.name.toLowerCase() === 'health');

    let usersToNotify = [];
    if (isHealthCategory) {
        usersToNotify = await User.find({ isBlockUser: false, isBannedUser: false });
    } else {
        usersToNotify = await User.find({
            isBlockUser: false,
            isBannedUser: false,
            $or: [
                { _id: { $in: article.authorId.followers } },
                { 'notificationPreferences.contentClusters': { $in: article.tags.map(t => t._id) } }
            ]
        });
    }

    const articleLink = `https://ultimatehealth.blog/api/share/blog/${article.pb_recordId}`;
    const notifTitle = `New Article by ${article.authorId.user_name}`;
    const notifMessage = article.title;

    for (const user of usersToNotify) {
        try {
            const entry = {
                email: user.email || null,
                articleLink,
                authorName: article.authorId.user_name,
                articleTitle: article.title,
                fcmToken: null,
                title: notifTitle,
                message: notifMessage
            };

            if (user.fcmToken) {
                const notification = new Notification({
                    userId: user._id,
                    adminId: null,
                    articleId: article._id,
                    podcastId: null,
                    articleRecordId: article.pb_recordId,
                    revisonId: null,
                    commentId: null,
                    type: 'article',
                    title: notifTitle,
                    message: notifMessage,
                    read: false,
                    timestamp: timestamp || Date.now()
                });
                await notification.save();
                entry.fcmToken = user.fcmToken;
            }

            results.push(entry);
        } catch (err) {
            console.error(`Error saving notification for user ${user._id}:`, err);
        }
    }

    return results;
};

const broadcastSubscribers = async (event) => {

    try {
        const { articleId, userIds } = event;
        // const [article, users] = await Promise.all([
        //     Article.findById(articleId).populate('authorId', 'name').lean(),
        //     User.find({ _id: { $in: userIds }, isBlockUser: false, isBannedUser: false })
        //         .select('email fcmToken notificationPreferences')
        //         .lean()
        // ]);

        const article = await Article.findById(articleId).populate('authorId', 'user_name').lean();

        if (!article || article.is_removed) return;

        if(!userIds || userIds.length === 0 || !Array.isArray(userIds) ) {
            console.log(`No users to notify for article ${articleId}`);
            return;
        }

        /**
         * {
         *   email: user.email || null,
         *   user_name: user.user_name || null,
         *   fcmToken: user.fcmToken || null,
         * }
         */

        const notificationsToSave = [];
        const pushPromises = [];
        const emailPromises = [];

        for (const user of userIds) {

            if(!user || !user._id || !user.fcmToken || !user.email) {
                console.log(`Skipping user due to missing data: ${JSON.stringify(user)}`);
                continue;
            }
            const notificationMsg = `${article.authorId.user_name} published a new article: ${article.title}`;

            notificationsToSave.push({
                userId: user._id,
                articleId: article._id,
                type: 'article',
                title: "New Article Published",
                message: notificationMsg,
                read: false,
                timestamp: new Date()
            });

            if (user.fcmToken) {
                pushPromises.push(
                    sendPushNotification(user.fcmToken, { title: "New Article Published", body: notificationMsg }).catch(e => console.error(e))
                );
            }

            if (user.email) {
                emailPromises.push(
                    sendNewArticleEmail(user.email, article.title, article.authorId.user_name, `https://ultimatehealth.blog/article/${article._id}`).catch(e => console.error(e))
                );
            }
        }

        if (notificationsToSave.length > 0) {
            await Notification.insertMany(notificationsToSave);
        }

        await Promise.allSettled([...pushPromises, ...emailPromises]);
      
    } catch (err) {
        console.error('Error in handleBroadcastNotification:', err);
        throw err;
    }
}

module.exports = {
    // Social
    savePostLikeNotification,
    saveCommentNotification,
    saveCommentLikeNotification,
    saveUserFollowNotification,
    saveRepostNotifications,
    saveMentionNotifications,
    // Review
    saveArticleReviewNotification,
    savePodcastReviewNotification,
    saveArticleSubmitAdminNotification,
    // Broadcast
    savePostPublishedNotifications,
    broadcastNewArticleNotifications,
    broadcastSubscribers
};
