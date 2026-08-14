
const {globalProducer} = require('../../config/kafka');

const connectProducer = async ()=>{
    try{
        await globalProducer.connect(); // Connect the producer to the Kafka cluster
        console.log('Kafka producer connected successfully');
    }catch(err){
        console.error('Error connecting Kafka producer:', err); 
    }
}


// Content Notification Email event publish to Kafka
const publishContentEmailEvent = async (emailEvent) => {
   try{
      
      await globalProducer.send({
        topic: 'content-notification-events',
        messages: [
          {
            value: JSON.stringify(emailEvent)
          }
        ]
      });
      console.log('Content Notification Email event published to Kafka successfully');
   }catch(err){
     console.error('Error publishing Content Notification Email event to Kafka:', err);
   }
}

// Content Moderation Email event publish to Kafka
const publishModerationEmailEvent = async (emailEvent) => {
   try{
      
      await globalProducer.send({
        topic: 'content-moderation-events',
        messages: [
          {
            value: JSON.stringify(emailEvent)
          }
        ]
      });
      console.log('Content Moderation Email event published to Kafka successfully');
   }catch(err){
     console.error('Error publishing Content Moderation Email event to Kafka:', err);
   }
}

// Account Moderation Email event publish to Kafka
const publishAccountModerationEmailEvent = async (emailEvent) => {
   try{
      
      await globalProducer.send({
        topic: 'account-moderation-events',
        messages: [
          {
            value: JSON.stringify(emailEvent)
          }
        ]
      });
      console.log('Account Moderation Email event published to Kafka successfully');
   }catch(err){
     console.error('Error publishing account moderationemail event to Kafka:', err);
   }
}

// Support Email Event publish to Kafka

const publishSupportEmailEvent = async (emailEvent) => {
    try {
        await globalProducer.send({
            topic: 'support-email-events',
            messages: [
                {
                    value: JSON.stringify(emailEvent)
                }
            ]
        });
        console.log('Support Email event published to Kafka successfully');
    } catch (err) {
        console.error('Error publishing Support Email event to Kafka:', err);
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

const EMAIL_EVENT_TYPES = {
    CONTENT: {
        ARTICLE_FOR_REVIEW: 1,
        PODCAST_FOR_REVIEW: 2,
        ARTICLE_PUBLISHED: 3,
        PODCAST_PUBLISHED: 4,
        ARTICLE_DISCARD: 5,
        PODCAST_DISCARD: 6,
        ARTICLE_DISCARD_BY_ADMIN: 7,
        EDIT_REQUEST_APPROVAL: 8,
        PICK_ARTICLE: 9,
        PICK_PODCAST: 10,
        NEW_ARTICLE_PUBLISHED: 11,
        ARTICLE_FEEDBACK: 12
    },
    MODERATION: {
        REPORT_UNDERTAKEN: 1,
        INITIAL_REPORT_VICTIM: 2,
        INITIAL_REPORT_CONVICT: 3,
        RESOLVED_VICTIM: 4,
        RESOLVED_CONVICT: 5,
        WARNING_VICTIM_DISMISS: 6,
        DISMISSED_CONVICT: 7,
        WARNING_CONVICT: 8,
        REMOVE_CONTENT_CONVICT: 9,
        BLOCK_CONVICT: 10,
        BANNED_USER: 11
    },
    ACCOUNT: {
        UNBLOCK_USER: 1,
        RESTORE_CONTENT: 2,
        RESTORE_REQUEST_RECEIVED: 3,
        RESTORE_REQUEST_DISAPPROVED: 4
    },
    SUPPORT: {
        CONTACT_US: 1
    }
};

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

module.exports = {
    publishAccountModerationEmailEvent,
    publishContentEmailEvent,
    publishModerationEmailEvent,
    publishSupportEmailEvent,
    publishArticleAnalyticsEvent,
    publishPodcastAnalyticsEvent,
    publishAdminAnalyticsEvent,
    publishAnalyticsEvent,
    publishNotificationEvent,
    connectProducer,
    EMAIL_EVENT_TYPES,
    ANALYTICS_EVENT_TYPES
}

