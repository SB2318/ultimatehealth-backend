const { globalProducer } = require('../../config/kafka');

const connectProducer = async () => {
    try {
        await globalProducer.connect();
        console.log('Kafka producer connected successfully');
    } catch (err) {
        console.error('Error connecting Kafka producer:', err);
    }
};

module.exports = {
    connectProducer
};
