const { globalEmailConsumer, globalAnalyticsConsumer, globalNotificationConsumer } = require("../../../config/kafka");
const { handleEmailEvent } = require("./emailConsumer");
const { handleAnalyticsEvent } = require("./analyticsConsumer");
const { handleNotificationEvent } = require("./notificationConsumer");
const { publishDLQEvent } = require("./dlqConsumer");
const { SUBSCRIBED_EVENT_TYPES } = require('./kafkaTopics');
const { kafkaClient } = require("../../../config/kafka");

const connectEmailConsumer = async () => {
    try {
        await globalEmailConsumer.connect();

        // subscribe to the topic
        await globalEmailConsumer.subscribe({
            topics: [
                'content-notification-events',
                'content-moderation-events',
                'account-moderation-events',
                'support-email-events',
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
                    await handleEmailEvent(topic, message);

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

const connectAnalyticsConsumer = async () => {

    try {
        await globalAnalyticsConsumer.connect();

        await globalAnalyticsConsumer.subscribe({
            topics: [
                'article-analytics-events',
                'podcast-analytics-events',
                'admin-analytics-events',
            ],
            fromBeginning: false
        });

        await globalAnalyticsConsumer.run({

            partitionsConsumedConcurrently: 3,
            eachBatchAutoResolve: false,
            eachBatch: async ({
                batch,
                resolveOffset,
                heartbeat,
                commitOffsetsIfNecessary
            }) => {
                console.log(`Processing ${batch.messages.length} analytics events`);

                for (const message of batch.messages) {
                    // Process batch analytics event
                    const event = JSON.parse(message.value.toString());
                    try {
                        const topic = batch.topic;
                        await handleAnalyticsEvent(topic, event);
                        resolveOffset(message.offset);
                        await heartbeat();

                    } catch (err) {
                        console.log("analytics consumer error, sending to DLQ...", err, message);
                        await publishDLQEvent(batch.topic, event, err);
                        resolveOffset(message.offset);
                        await heartbeat();
                    }
                }
            }
        });
    } catch (err) {
        console.log("Analytics Consumer Error", err);
    }
}

const connectNotificationConsumer = async () => {

    try {

        await globalNotificationConsumer.connect();

        await globalNotificationConsumer.subscribe({
            topics: [
                'social-notification-events',
                'content-review-notifications',
                'broadcast-notifications'
            ],
            fromBeginning: false
        });

        await globalNotificationConsumer.run({
            partitionsConsumedConcurrently: 3,
            eachBatchAutoResolve: false,
            eachBatch: async ({
                batch,
                resolveOffset,
                heartbeat,
                commitOffsetsIfNecessary
            }) => {

                console.log(`Processing ${batch.messages.length} notification events`);

                for (const message of batch.messages) {
                    // Process batch analytics event
                    const event = JSON.parse(message.value.toString());
                    try {

                        const topic = batch.topic;
                        await handleNotificationEvent(topic, event);
                        resolveOffset(message.offset);
                        await heartbeat();

                    } catch (err) {
                        console.log("Notification consumer error, send to DLQ", err, message);
                        await publishDLQEvent(batch.topic, event, err);
                        resolveOffset(message.offset);
                        await heartBeat();
                    }
                }
            }
        })

    } catch (err) {
        console.log("Connect Notification Consumer Error", err);
    }
}

const connectDLQConsumer = async () => {

    try {

    } catch (err) {

    }
}

// Re-export from the dedicated constants file to avoid circular dependencies


const initKafkaTopics = async () => {
    const admin = kafkaClient.admin();
    try {
        console.log("Connecting Kafka Admin to ensure topics exist...");
        await admin.connect();
        const existingTopics = await admin.listTopics();
        const topicsToCreate = Object.values(SUBSCRIBED_EVENT_TYPES)
            .filter(topic => !existingTopics.includes(topic))
            .map(topic => ({ topic, numPartitions: 1, replicationFactor: 2 }));
        
        if (topicsToCreate.length > 0) {
            await admin.createTopics({ topics: topicsToCreate });
            console.log(`Successfully created ${topicsToCreate.length} missing Kafka topics.`);
        } else {
            console.log("All required Kafka topics already exist.");
        }
    } catch (err) {
        console.error("Failed to initialize Kafka topics (they might be auto-created later):", err.message);
    } finally {
        await admin.disconnect();
    }
};

module.exports = {
    initKafkaTopics,
    connectEmailConsumer,
    connectAnalyticsConsumer,
    connectNotificationConsumer,
    SUBSCRIBED_EVENT_TYPES
}