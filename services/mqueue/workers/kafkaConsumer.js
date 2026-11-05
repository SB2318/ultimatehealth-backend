const { globalEmailConsumer, globalAnalyticsConsumer, globalNotificationConsumer } = require("../../../config/kafka");
const { handleEmailEvent } = require("./emailConsumer");
const { handleAnalyticsEvent } = require("./analyticsConsumer");
const { handleNotificationEvent } = require("./notificationConsumer");
const { publishDLQEvent } = require("../producers/dlqProducer");
const { SUBSCRIBED_EVENT_TYPES } = require('./kafkaTopics');
const { kafkaClient } = require("../../../config/kafka");

const startConsumerWithRetry = async ({
    name,
    consumer,
    topics,
    runOptions,
    fromBeginning = false,
    maxRetries = 8,
    initialDelayMs = 2000
}) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;
        try {
            console.log(`[Kafka Consumer: ${name}] Connecting (attempt ${attempt}/${maxRetries})...`);
            await consumer.connect();

            console.log(`[Kafka Consumer: ${name}] Subscribing to topics:`, topics);
            await consumer.subscribe({
                topics,
                fromBeginning
            });

            console.log(`[Kafka Consumer: ${name}] Starting message processing loop...`);
            await consumer.run(runOptions);

            console.log(`[Kafka Consumer: ${name}] Successfully connected and listening.`);
            return;
        } catch (err) {
            console.error(`[Kafka Consumer: ${name}] Startup error (attempt ${attempt}/${maxRetries}):`, err.message || err);

            try {
                await consumer.disconnect();
            } catch (_) {
                // Ignore disconnect cleanup errors
            }

            if (attempt >= maxRetries) {
                console.error(`[Kafka Consumer: ${name}] Max startup retries reached. Consumer could not be started.`);
                return;
            }

            const delay = Math.min(initialDelayMs * Math.pow(1.5, attempt - 1), 15000);
            console.log(`[Kafka Consumer: ${name}] Retrying in ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

const connectEmailConsumer = async () => {
    const topics = [
        SUBSCRIBED_EVENT_TYPES.CONTENT_NOTIFICATION,
        SUBSCRIBED_EVENT_TYPES.CONTENT_MODERATION,
        SUBSCRIBED_EVENT_TYPES.ACCOUNT_MODERATION,
        SUBSCRIBED_EVENT_TYPES.SUPPORT_EMAIL,
    ];

    await startConsumerWithRetry({
        name: 'EmailConsumer',
        consumer: globalEmailConsumer,
        topics,
        fromBeginning: false,
        runOptions: {
            partitionsConsumedConcurrently: 3,
            eachMessage: async ({ topic, message }) => {
                try {
                    await handleEmailEvent(topic, message);
                } catch (err) {
                    console.error(`[EmailConsumer] Failed to process message from ${topic}:`, err);
                }
            }
        }
    });
};

const connectAnalyticsConsumer = async () => {
    const topics = [
        SUBSCRIBED_EVENT_TYPES.ARTICLE_ANALYTICS,
        SUBSCRIBED_EVENT_TYPES.PODCAST_ANALYTICS,
        SUBSCRIBED_EVENT_TYPES.ADMIN_ANALYTICS,
    ];

    await startConsumerWithRetry({
        name: 'AnalyticsConsumer',
        consumer: globalAnalyticsConsumer,
        topics,
        fromBeginning: false,
        runOptions: {
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
                    let event;
                    try {
                        event = JSON.parse(message.value.toString());
                    } catch (parseErr) {
                        console.error("Failed to parse analytics message value:", parseErr);
                        resolveOffset(message.offset);
                        await heartbeat();
                        continue;
                    }

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
        }
    });
};

const connectNotificationConsumer = async () => {
    const topics = [
        SUBSCRIBED_EVENT_TYPES.SOCIAL_NOTIFICATION,
        SUBSCRIBED_EVENT_TYPES.CONTENT_REVIEW,
        SUBSCRIBED_EVENT_TYPES.BROADCAST_NOTIFICATION,
    ];

    await startConsumerWithRetry({
        name: 'NotificationConsumer',
        consumer: globalNotificationConsumer,
        topics,
        fromBeginning: false,
        runOptions: {
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
                    let event;
                    try {
                        event = JSON.parse(message.value.toString());
                    } catch (parseErr) {
                        console.error("Failed to parse notification message value:", parseErr);
                        resolveOffset(message.offset);
                        await heartbeat();
                        continue;
                    }

                    try {
                        const topic = batch.topic;
                        await handleNotificationEvent(topic, event);
                        resolveOffset(message.offset);
                        await heartbeat();
                    } catch (err) {
                        console.log("Notification consumer error, send to DLQ", err, message);
                        await publishDLQEvent(batch.topic, event, err);
                        resolveOffset(message.offset);
                        await heartbeat();
                    }
                }
            }
        }
    });
};

const connectDLQConsumer = async () => {
    try {
        // Reserved for future DLQ processing worker
    } catch (err) {
        console.error("DLQ Consumer error:", err);
    }
};

/**
 * Initializes all required Kafka topics with dynamic broker-aware replication factor
 * and ensures partition leader election completes before resolving.
 */
const initKafkaTopics = async (maxRetries = 5, retryDelayMs = 2000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const admin = kafkaClient.admin();
        try {
            console.log(`[Kafka Admin] Connecting to ensure topics exist (attempt ${attempt}/${maxRetries})...`);
            await admin.connect();

            // Detect active broker count dynamically to avoid INVALID_REPLICATION_FACTOR
            let availableBrokers = 1;
            try {
                const cluster = await admin.describeCluster();
                if (cluster && Array.isArray(cluster.brokers) && cluster.brokers.length > 0) {
                    availableBrokers = cluster.brokers.length;
                }
            } catch (clusterErr) {
                console.warn(`[Kafka Admin] Could not describe cluster, defaulting broker count to 1: ${clusterErr.message}`);
            }

            const envReplication = Number(process.env.KAFKA_REPLICATION_FACTOR) || 1;
            const replicationFactor = Math.max(1, Math.min(availableBrokers, envReplication));

            const existingTopics = await admin.listTopics();
            const topicsToCreate = Object.values(SUBSCRIBED_EVENT_TYPES)
                .filter(topic => !existingTopics.includes(topic))
                .map(topic => ({
                    topic,
                    numPartitions: Number(process.env.KAFKA_NUM_PARTITIONS) || 1,
                    replicationFactor
                }));

            if (topicsToCreate.length > 0) {
                console.log(`[Kafka Admin] Creating ${topicsToCreate.length} missing Kafka topic(s) with replicationFactor ${replicationFactor}...`);
                await admin.createTopics({
                    waitForLeaders: true,
                    timeout: 20000,
                    topics: topicsToCreate
                });
                console.log(`[Kafka Admin] Successfully created ${topicsToCreate.length} missing Kafka topic(s).`);
            } else {
                console.log("[Kafka Admin] All required Kafka topics already exist.");
            }

            await admin.disconnect();
            return true;
        } catch (err) {
            console.error(`[Kafka Admin] Topic initialization error (attempt ${attempt}/${maxRetries}):`, err.message || err);
            try {
                await admin.disconnect();
            } catch (_) {}

            if (attempt === maxRetries) {
                console.error("[Kafka Admin] Max retries reached for topic initialization. Broker auto-creation will serve as fallback.");
                return false;
            }

            await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
        }
    }
};

module.exports = {
    initKafkaTopics,
    connectEmailConsumer,
    connectAnalyticsConsumer,
    connectNotificationConsumer,
    connectDLQConsumer,
    SUBSCRIBED_EVENT_TYPES
};
