const { Kafka } = require('kafkajs');

// Create a Kafka client instance with the specified configuration
const kafkaBrokers = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka1:9092', 'kafka2:9092', 'kafka3:9092'];

const kafkaClient = new Kafka({
  clientId: 'ultimatehealth-backend',
  brokers: kafkaBrokers // Apache Kafka cluster
});

const globalProducer = kafkaClient.producer({
  allowAutoTopicCreation: false
}); // Create a Kafka producer instance, to handle DLQ

//const globalCconsumer = kafkaClient.consumer({ groupId: 'ultimatehealth-group' }); // Create a Kafka consumer instance, to consume messages from Kafka topics

const globalEmailConsumer = kafkaClient.consumer({
  groupId: "ultimatehealth-email-worker",
  retry: {
    retries: 5,
    initialRetryTime: 1000,   // 1 second
    factor: 2             // doubles each attempt
  }
});

const globalAnalyticsConsumer = kafkaClient.consumer({
  groupId: "ultimatehealth-analytics-worker",
  retry: {
    retries: 5,
    initialRetryTime: 1000,   // 1 second
    factor: 3               // doubles each attempt
  },
  maxWaitTimeInMs: 1000, // Maximum time in ms Kafka waits for enough data
  minBytes: 1, // Minimum amount of data Kafka tries to accumulate
  maxBytes: 3 * 1024 * 1024, // Maximum data returned in a fetch
  maxBytesPerPartition: 1024 * 1024 // Maximum data from one partition
});

const globalNotificationConsumer = kafkaClient.consumer({
  groupId: "ultimatehealth-notification-worker",
  retry: {
    retries: 5,
    initialRetryTime: 1000,   // 1 second
    factor: 2               // doubles each attempt
  },
  maxWaitTimeInMs: 2000, // Maximum time in ms Kafka waits for enough data
  minBytes: 1, // Minimum amount of data Kafka tries to accumulate
  maxBytes: 5 * 1024 * 1024, // Maximum data returned in a fetch
  maxBytesPerPartition: 1024 * 1024 // Maximum data from one partition
});

module.exports = {
  kafkaClient,
  globalProducer,
  globalEmailConsumer,
  globalAnalyticsConsumer,
  globalNotificationConsumer
}