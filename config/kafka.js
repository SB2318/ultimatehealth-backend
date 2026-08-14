const {Kafka} = require('kafkajs');

// Create a Kafka client instance with the specified configuration
const kafkaClient = new Kafka({
  clientId: 'ultimatehealth-backend',
  brokers: ['kafka1:9092', 'kafka2:9092', 'kafka3:9092'] // Apache Kafka clusture with  3 brokers
});

const globalProducer = kafkaClient.producer(); // Create a Kafka producer instance, to send messages to Kafka topics

const globalCconsumer = kafkaClient.consumer({ groupId: 'ultimatehealth-group' }); // Create a Kafka consumer instance, to consume messages from Kafka topics

module.exports = {
    kafkaClient,    
    globalProducer,
    globalCconsumer
}