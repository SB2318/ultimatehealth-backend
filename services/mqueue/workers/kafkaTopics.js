/**
 * Kafka topic name constants shared across producers and consumers.
 * Extracted here to avoid circular dependency between kafkaConsumer.js
 * and the individual consumer handlers that reference these constants.
 */
const SUBSCRIBED_EVENT_TYPES = {
    ARTICLE_ANALYTICS: 'article-analytics-events',
    PODCAST_ANALYTICS: 'podcast-analytics-events',
    ADMIN_ANALYTICS: 'admin-analytics-events',
    CONTENT_NOTIFICATION: 'content-notification-events',
    CONTENT_MODERATION: 'content-moderation-events',
    ACCOUNT_MODERATION: 'account-moderation-events',
    SUPPORT_EMAIL: 'support-email-events',
    SOCIAL_NOTIFICATION: 'social-notification-events',
    CONTENT_REVIEW: 'content-review-notifications',
    BROADCAST_NOTIFICATION: 'broadcast-notifications',
    DEAD_LETTER: 'dead-letter-events',
};

module.exports = { SUBSCRIBED_EVENT_TYPES };
