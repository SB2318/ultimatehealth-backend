
const {globalProducer} = require('../../config/kafka');

const connectProducer = async ()=>{
    try{
        await globalProducer.connect(); // Connect the producer to the Kafka cluster
        console.log('Kafka producer connected successfully');
    }catch(err){
        console.error('Error connecting Kafka producer:', err); 
    }
}

const publishEmailEvent = async (emailEvent) => {
   try{
      
      await globalProducer.send({
        topic: 'email-events',
        messages: [
          {
            value: JSON.stringify(emailEvent)
          }
        ]
      });
      console.log('Email event published to Kafka successfully');
   }catch(err){
     console.error('Error publishing email event to Kafka:', err);
   }
}

const publishAnalyticsEvent = async (analyticsEvent) => {
      
     try{
       
        await globalProducer.send({
            topic: 'analytics-events',
            messages: [
             {
                value: JSON.stringify(analyticsEvent)
             }
            ]
        });

        console.log(" Analytics event produce successfully");
     }catch(err){
         console.error('Error publishing analytics event to Kafka:', err);
     }
}

const publishNotificationEvent = async (notificationEvent) => {
      
     try{
       
        await globalProducer.send({
            topic: 'notification-events',
            messages: [
             {
                value: JSON.stringify(notificationEvent)
             }
            ]
        });

        console.log("Notification event produce successfully");
     }catch(err){
         console.error('Error publishing notification event to Kafka:', err);
     }
}

module.exports = {
    publishEmailEvent,
    publishAnalyticsEvent,
    publishNotificationEvent,
    connectProducer
}

