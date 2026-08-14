const { globalProducer } = require('../../config/kafka');

const ANALYTICS_EVENT_TYPES = {
    ARTICLE: {
        READ: 1,
        WRITE: 2
    },
    PODCAST: {
        VIEW: 1,
        LIKE: 2,
        WRITE: 3
    },
    ADMIN: {
        CONTRIBUTION: 1
    }
};

const publishArticleAnalyticsEvent = async (analyticsEvent) => {
    try {
        await globalProducer.send({
            topic: 'article-analytics-events',
            messages: [
                { value: JSON.stringify(analyticsEvent) }
            ]
        });
        console.log('Article Analytics event published to Kafka successfully');
    } catch (err) {
        console.error('Error publishing Article Analytics event to Kafka:', err);
    }
};

const publishPodcastAnalyticsEvent = async (analyticsEvent) => {
    try {
        await globalProducer.send({
            topic: 'podcast-analytics-events',
            messages: [
                { value: JSON.stringify(analyticsEvent) }
            ]
        });
        console.log('Podcast Analytics event published to Kafka successfully');
    } catch (err) {
        console.error('Error publishing Podcast Analytics event to Kafka:', err);
    }
};

const publishAdminAnalyticsEvent = async (analyticsEvent) => {
    try {
        await globalProducer.send({
            topic: 'admin-analytics-events',
            messages: [
                { value: JSON.stringify(analyticsEvent) }
            ]
        });
        console.log('Admin Analytics event published to Kafka successfully');
    } catch (err) {
        console.error('Error publishing Admin Analytics event to Kafka:', err);
    }
};

module.exports = {
    publishArticleAnalyticsEvent,
    publishPodcastAnalyticsEvent,
    publishAdminAnalyticsEvent,
    ANALYTICS_EVENT_TYPES
};
