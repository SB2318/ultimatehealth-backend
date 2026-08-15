const ReadAggregate = require("../../models/events/readEventSchema");
const WriteAggregate = require("../../models/events/writeEventSchema");
const AudioViewAggregate = require("../../models/events/audioViewEventSchema");
const AudioLikeAggregate = require("../../models/events/audioLikeEventSchema");
const AudioWriteAggregate = require("../../models/events/audioWriteEventSchema");
const AdminAggregate = require("../../models/events/adminContributionEvent");

const getMidNight = () => {
    const date = new Date();
    return new Date(date.setHours(0, 0, 0, 0));
}

const recordArticleRead = ({ userId }) => {

    const today = getMidNight();

    await ReadAggregate.updateOne(
        { userId: userId, date: today },
        {
            $inc: { dailyReads: 1, monthlyReads: 1, yearlyReads: 1 }
        },
        { upsert: true } // If it doesn't exist, create it automatically
    );
}

const recordArticleWrite = ({ userId }) => {

    const today = getMidNight();
    await WriteAggregate.updateOne(
        { userId: userId, date: today }, // The lookup
        {
            $inc: { dailyWrites: 1, monthlyWrites: 1, yearlyWrites: 1 }
        },
        { upsert: true } // If it doesn't exist, create it automatically
    );
}

const recordPodcastView = ({ userId }) => {
    const today = getMidNight();

    await AudioViewAggregate.updateOne(
        { userId: userId, date: today }, // The lookup
        {
            $inc: { dailyViews: 1, monthlyViews: 1, yearlyViews: 1 } // The math
        },
        { upsert: true } // If it doesn't exist, create it automatically
    );

}

const recordPodcastLike = ({ userId }) => {
    const today = getMidNight();

    await AudioLikeAggregate.updateOne(
        { userId: userId, date: today },
        {
            $inc: { dailyLikes: 1, monthlyLikes: 1, yearlyLikes: 1 }
        },
        { upsert: true } // If it doesn't exist, create it automatically
    );
}

const recordPodcastCreation = ({ userId }) => {
    const today = getMidNight();

    await AudioWriteAggregate.updateOne(
        { userId: userId, date: today }, // The lookup
        {
            $inc: { monthlyUploads: 1, yearlyUploads: 1 } // The math
        },
        { upsert: true } // If it doesn't exist, create it automatically
    );

}

const recordAdminContribution = async (adminId, contributionType) => {
    // The schema automatically generates the `date`, `day`, and `month` fields

    const newContribution = new AdminAggregate({
        userId: adminId,
        contributionType: contributionType
    });
    await newContribution.save();
};

module.exports = {
    recordArticleRead,
    recordArticleWrite,
    recordPodcastCreation,
    recordPodcastLike,
    recordPodcastView,
    recordAdminContribution
}

