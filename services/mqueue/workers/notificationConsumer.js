const { sendPushNotification } = require('../../../controllers/notifications/notificationHelper');

const { sendNewArticleEmail } = require("../../../controllers/emailservice");

const { SUBSCRIBED_EVENT_TYPES } = require("./kafkaConsumer");
const { NOTIFICATION_EVENT_TYPES } = require("../producers/notificationProducer");

const {
    savePostLikeNotification,
    saveCommentNotification,
    saveCommentLikeNotification,
    saveUserFollowNotification,
    saveRepostNotifications,
    saveMentionNotifications,
    saveArticleReviewNotification,
    savePodcastReviewNotification,
    saveArticleSubmitAdminNotification,
    savePostPublishedNotifications,
    broadcastNewArticleNotifications
} = require('../../db/notificationService');

const handleNotificationEvent = async (topic, event) => {
    try {
      //  const event = JSON.parse(message.value.toString());

        switch (topic.toString()) {
            case SUBSCRIBED_EVENT_TYPES.SOCIAL_NOTIFICATION:
                await handleSocialNotification(event);
                break;
            case SUBSCRIBED_EVENT_TYPES.CONTENT_REVIEW:
                await handleReviewNotification(event);
                break;
            case SUBSCRIBED_EVENT_TYPES.BROADCAST_NOTIFICATION:
                await handleBroadcastNotification(event);
                break;
            default:
                console.log('Unknown notification topic:', topic);
        }
    } catch (err) {
        console.error('Notification event processing error:', err);
        throw err; // Throw tells KafkaJS to retry
    }
};



const handleSocialNotification = async (event) => {
    try {
        switch (event.type) {

            case NOTIFICATION_EVENT_TYPES.SOCIAL.POST_LIKE: {
                const fcmToken = await savePostLikeNotification(event);
                if (fcmToken) sendPushNotification(fcmToken, { title: event.title, body: event.message });
                break;
            }

            case NOTIFICATION_EVENT_TYPES.SOCIAL.POST_COMMENT: {
                const fcmToken = await saveCommentNotification(event);
                if (fcmToken) sendPushNotification(fcmToken, { title: event.title, body: event.message });
                break;
            }

            case NOTIFICATION_EVENT_TYPES.SOCIAL.COMMENT_LIKE: {
                const fcmToken = await saveCommentLikeNotification(event);
                if (fcmToken) sendPushNotification(fcmToken, { title: event.title, body: event.message });
                break;
            }

            case NOTIFICATION_EVENT_TYPES.SOCIAL.USER_FOLLOW: {
                const result = await saveUserFollowNotification(event);
                if (result) sendPushNotification(result.fcmToken, result.payload);
                break;
            }

            case NOTIFICATION_EVENT_TYPES.SOCIAL.REPOST: {
                const targets = await saveRepostNotifications(event);
                for (const t of targets) sendPushNotification(t.fcmToken, { title: t.title, body: t.message });
                break;
            }

            case NOTIFICATION_EVENT_TYPES.SOCIAL.MENTION: {
                const targets = await saveMentionNotifications(event);
                for (const t of targets) sendPushNotification(t.fcmToken, { title: t.title, body: t.message });
                break;
            }

            default:
                console.log('Social Notification type not found:', event.type);
        }
    } catch (err) {
        console.error('Error in handleSocialNotification:', err);
        throw err;
    }
};



const handleReviewNotification = async (event) => {
    try {
        switch (event.type) {

            case NOTIFICATION_EVENT_TYPES.REVIEW.ARTICLE_REVIEW_USER: {
                const fcmToken = await saveArticleReviewNotification(event);
                if (fcmToken) sendPushNotification(fcmToken, { title: event.title, body: event.message });
                break;
            }

            case NOTIFICATION_EVENT_TYPES.REVIEW.PODCAST_REVIEW_USER: {
                const fcmToken = await savePodcastReviewNotification(event);
                if (fcmToken) sendPushNotification(fcmToken, { title: event.title, body: event.message });
                break;
            }

            case NOTIFICATION_EVENT_TYPES.REVIEW.ARTICLE_SUBMIT_ADMIN: {
                const fcmToken = await saveArticleSubmitAdminNotification(event);
                if (fcmToken) sendPushNotification(fcmToken, { title: event.title, body: event.message });
                break;
            }

            default:
                console.log('Review Notification type not found:', event.type);
        }
    } catch (err) {
        console.error('Error in handleReviewNotification:', err);
        throw err;
    }
};



const handleBroadcastNotification = async (event) => {
    try {
        switch (event.type) {

            case NOTIFICATION_EVENT_TYPES.BROADCAST.POST_PUBLISHED_BROADCAST: {
                const targets = await savePostPublishedNotifications(event);
                for (const t of targets) sendPushNotification(t.fcmToken, { title: t.title, body: t.message });
                break;
            }

            case NOTIFICATION_EVENT_TYPES.BROADCAST.NEW_ARTICLE_BROADCAST: {
                // All DB logic lives in broadcastNewArticleNotifications
                const results = await broadcastNewArticleNotifications(event);
                for (const r of results) {
                    if (r.email) {

                        await sendNewArticleEmail(r.email, r.articleTitle, r.authorName, r.articleLink);
                    }
                    if (r.fcmToken) {
                        sendPushNotification(r.fcmToken, { title: r.title, body: r.message });
                    }
                }
                break;
            }

            default:
                console.log('Broadcast Notification type not found:', event.type);
        }
    } catch (err) {
        console.error('Error in handleBroadcastNotification:', err);
        throw err;
    }
};

module.exports = { handleNotificationEvent };