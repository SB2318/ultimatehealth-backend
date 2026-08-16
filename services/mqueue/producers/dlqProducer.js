
const {globalProducer} = require("../../../config/kafka");

const publishDLQEvent = async (originalTopic, message, error) =>{

    try{
       
         const dlqPayload = {
            originalTopic,
            stack: error.stack,
            error: error.message,
            failedAt: new Date().toISOString(),
            originalMessage: message
         };

         await globalProducer.send({
            topic: 'dead-letter-events',
            messages: [
                {
                    value: JSON.stringify(dlqPayload)
                }
            ]
         });

        console.log(`Sent failed message from ${originalTopic} to DLQ.`);
    }catch(err){
           console.error('CRITICAL: Failed to publish to DLQ', err);
    }
}

module.exports = {
    publishDLQEvent
}

