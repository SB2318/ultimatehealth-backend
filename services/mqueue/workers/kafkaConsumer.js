const { globalEmailConsumer } = require("../../../config/kafka");
const { handleEmailEvent } = require("./emailConsumer");

const connectEmailConsumer = async () => {
    try {
        await globalEmailConsumer.connect();
      

        // subscribe to the topic
        await globalEmailConsumer.subscribe({
            topics: [
                'article-analytics-events',
                'podcast-analytics-events',
                'admin-analytics-events',
                'content-notification-events',
                'content-moderation-events',
                'account-moderation-events',
                'support-email-events',
                'social-notification-events',
                'content-review-notifications',
                'broadcast-notifications'
            ],
            fromBeginning: false
        });

        // Listen the events
        // If data is 1 producer to 1 Consumer, It will be better to set consumption per message
        // Or If it is 1 to many, then it will be better batch processing
        // Here, I have once case for email also, where I have to do batch processing
        
        await globalEmailConsumer.run({
            partitionsConsumedConcurrently: 3,
            eachMessage: async ({ topic, message }) => {

                try {

                    if (
                        [
                            'content-notification-events',
                            'content-moderation-events',
                            'account-moderation-events',
                            'support-email-events'
                        ].includes(topic.toString())
                    ) {
                        await handleEmailEvent(topic, message);
                    }

                } catch (err) {
                    console.error(`[Consumer] Failed to process message from ${topic}:`, err);
                }
            }
        })

        console.log("Kafka consumer subscribed to the topic successfully");
    } catch (err) {
        console.error("Error connecting Kafka consumer:", err);
    }
}

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
    BROADCAST_NOTIFICATION: 'broadcast-notifications'
}

module.exports = {
    connectEmailConsumer,
    SUBSCRIBED_EVENT_TYPES
}