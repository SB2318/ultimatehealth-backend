
const {
    recordArticleRead,
    recordArticleWrite,
    recordPodcastCreation,
    recordPodcastLike,
    recordPodcastView,
    recordAdminContribution
} = require("../../db/analyticService");

const {SUBSCRIBED_EVENT_TYPES} = require("../workers/kafkaConsumer");
const {ANALYTICS_EVENT_TYPES} = require("../producers/analyticsProducer");

const handleAnalyticsEvent = async (topic, event)=>{

     try{

         switch(topic.toString()){
             
            case SUBSCRIBED_EVENT_TYPES.ADMIN_ANALYTICS :
                if(event.userId && event.contributionType){
                    await recordAdminContribution({
                        adminId: event.userId,
                        contributionType: event.contributionType
                    });
                }
                break;

            case SUBSCRIBED_EVENT_TYPES.ARTICLE_ANALYTICS:
                await handleArticleContribution(event);
                break;
            
            case SUBSCRIBED_EVENT_TYPES.PODCAST_ANALYTICS:
                await handlePodcastContribution(event);
                break;

            default:
                console.log("Analytics subscription invalid");
             
         }
         
     }catch(err){
        console.log("Analytics event error", err);
        throw err; // kafka will retry
     }
}

const handleArticleContribution = async (event)=>{

    switch(event.type){

        case ANALYTICS_EVENT_TYPES.ARTICLE.READ:
         if(event.userId && event.articleId && event.timestamp){
            await recordArticleRead({userId: event.userId, articleId: event.articleId, timestamp: event.timestamp});
         }
         break;
        
        case ANALYTICS_EVENT_TYPES.ARTICLE.WRITE:
          if(event.userId){
             await recordArticleWrite({userId: event.userId});
          }
         break;

         default:
            console.log("Article analytics topic not found");
        
    }
}

const handlePodcastContribution = async (event)=>{

    switch(event.type){

        case ANALYTICS_EVENT_TYPES.PODCAST.LIKE:
          if(event.userId){
            await recordPodcastLike({
                userId: event.userId
            });
          }
          break;
        
        case ANALYTICS_EVENT_TYPES.PODCAST.VIEW:
          if(event.userId){
            await recordPodcastView({
             userId: event.userId
            });
          }
          break;
        
        default:
            console.log("Analytics Podcast Topic Not Found");
    }
}

module.exports = {
    handleAnalyticsEvent
}