const { globalProducer } = require('../../config/kafka');

const connectProducer = async (maxRetries = 5, retryDelayMs = 2000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await globalProducer.connect();
            console.log('Kafka producer connected successfully');
            return true;
        } catch (err) {
            console.error(`Error connecting Kafka producer (attempt ${attempt}/${maxRetries}):`, err.message || err);
            if (attempt === maxRetries) {
                console.error('CRITICAL: Exhausted retries connecting Kafka producer.');
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
        }
    }
};

module.exports = {
    connectProducer
};
