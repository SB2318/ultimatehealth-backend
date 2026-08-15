const { globalProducer } = require('../../../config/kafka');

const NOTIFICATION_EVENT_TYPES = {
    SOCIAL: {
        POST_LIKE: 1,
        POST_COMMENT: 2,
        COMMENT_LIKE: 3,
        USER_FOLLOW: 4,
        REPOST: 5,
        MENTION: 6
    },
    REVIEW: {
        ARTICLE_REVIEW_USER: 1,
        PODCAST_REVIEW_USER: 2,
        ARTICLE_SUBMIT_ADMIN: 3
    },
    BROADCAST: {
        POST_PUBLISHED_BROADCAST: 1,
        NEW_ARTICLE_BROADCAST: 2
    }
};

const publishSocialNotificationEvent = async (notificationEvent) => {
    try {
        await globalProducer.send({
            topic: 'social-notification-events',
            messages: [
                { value: JSON.stringify(notificationEvent) }
            ]
        });
        console.log('Social Notification event published to Kafka successfully');
    } catch (err) {
        console.error('Error publishing Social Notification event to Kafka:', err);
    }
};

const publishReviewNotificationEvent = async (notificationEvent) => {
    try {
        await globalProducer.send({
            topic: 'content-review-notifications',
            messages: [
                { value: JSON.stringify(notificationEvent) }
            ]
        });
        console.log('Content Review Notification event published to Kafka successfully');
    } catch (err) {
        console.error('Error publishing Content Review Notification event to Kafka:', err);
    }
};

const publishBroadcastNotificationEvent = async (notificationEvent) => {
    try {
        await globalProducer.send({
            topic: 'broadcast-notifications',
            messages: [
                { value: JSON.stringify(notificationEvent) }
            ]
        });
        console.log('Broadcast Notification event published to Kafka successfully');
    } catch (err) {
        console.error('Error publishing Broadcast Notification event to Kafka:', err);
    }
};

module.exports = {
    publishSocialNotificationEvent,
    publishReviewNotificationEvent,
    publishBroadcastNotificationEvent,
    NOTIFICATION_EVENT_TYPES
};
