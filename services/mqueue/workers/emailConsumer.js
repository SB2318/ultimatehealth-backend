const { SUBSCRIBED_EVENT_TYPES } = require("../workers/kafkaTopics");
const { EMAIL_EVENT_TYPES } = require("../producers/emailProducer");
const {
    // Content
    sendArticleForReviewEmail,
    sendPodcastForReviewEmail,
    sendArticlePublishedEmail,
    sendPodcastPublishedEmail,
    sendArticleDiscardEmail,
    sendPodcastDiscardEmail,
    sendMailArticleDiscardByAdmin,
    sendMailOnEditRequestApproval,
    pickArticleMail,
    pickPodcastMail,
    sendNewArticleEmail,
    sendArticleFeedbackEmail,

    // Moderation
    sendReportUndertakenEmail,
    sendInitialReportMailtoVictim,
    sendInitialReportMailtoConvict,
    sendResolvedMailToVictim,
    sendResolvedMailToConvict,
    sendWarningMailToVictimOnReportDismissOrIgnore,
    sendRemoveContentMailToConvict,
    sendDismissedOrIgnoreMailToConvict,
    sendWarningMailToConvict,
    sendBlockConvictMail,
    sendBannedUserMail,

    // Account
    sendUnblockUserMail,
    sendRestoreContentMailToUser,
    sendRestoreRequestReceivedMail,
    sendRestoreRequestDisapprovedMail,

    // Support
    sendContactUsMail


} = require("../../../controllers/emailservice");




const handleEmailEvent = async (topic, message) => {

    try {

        const emailEvent = JSON.parse(message.value.toString());

        switch (topic) {

            case SUBSCRIBED_EVENT_TYPES.CONTENT_NOTIFICATION:
                console.log('Received Content Notification Email event:', emailEvent);
                await handleContentNotificationEmailEvent(emailEvent);
                break;

            case SUBSCRIBED_EVENT_TYPES.CONTENT_MODERATION:
                console.log('Received Content Moderation Email event:', emailEvent);
                await handleContentModerationEmailEvent(emailEvent);
                break;

            case SUBSCRIBED_EVENT_TYPES.ACCOUNT_MODERATION:
                console.log('Received Account Moderation Email event:', emailEvent);
                await handleAccountModerationEmailEvent(emailEvent);
                break;
            case SUBSCRIBED_EVENT_TYPES.SUPPORT_EMAIL:
                console.log('Received Support Email event:', emailEvent);
                await handleSupportEmailEvent(emailEvent);
                break;
            default:
                console.log('Received unknown email event type:', topic);
        }
    } catch (err) {
         throw err;
    }
}

const handleContentNotificationEmailEvent = async (emailEvent) => {

    console.log('Handling Content Notification Email event:', emailEvent);

    switch (emailEvent.groupIndex) {

        case EMAIL_EVENT_TYPES.CONTENT.ARTICLE_FOR_REVIEW:
            if (emailEvent.email && emailEvent.title) {
                await sendArticleForReviewEmail(emailEvent.email, emailEvent.title);
            }
            break;

        case EMAIL_EVENT_TYPES.CONTENT.PODCAST_FOR_REVIEW:
            if (emailEvent.email && emailEvent.title) {
                await sendPodcastForReviewEmail(emailEvent.email, emailEvent.title);
            }
            break;

        case EMAIL_EVENT_TYPES.CONTENT.ARTICLE_PUBLISHED:
            if (emailEvent.email && emailEvent.title && emailEvent.articleLink) {
                await
                    sendArticlePublishedEmail(
                        emailEvent.email,
                        emailEvent.articleLink,
                        emailEvent.title
                    );
            }
            break;

        case EMAIL_EVENT_TYPES.CONTENT.PODCAST_PUBLISHED:
            if (emailEvent.email && emailEvent.title && emailEvent.podcastLink) {
                await sendPodcastPublishedEmail(
                    emailEvent.email,
                    emailEvent.podcastLink,
                    emailEvent.title
                );
            }
            break;

        case EMAIL_EVENT_TYPES.CONTENT.ARTICLE_DISCARD:
            if (
                emailEvent.email && emailEvent.title
                && emailEvent.status && emailEvent.reason
            ) {
                await sendArticleDiscardEmail(
                    emailEvent.email,
                    emailEvent.status,
                    emailEvent.title,
                    emailEvent.reason
                );
            }
            break;

        case EMAIL_EVENT_TYPES.CONTENT.PODCAST_DISCARD:

            if (
                emailEvent.email && emailEvent.title
                && emailEvent.status && emailEvent.reason
            ) {
                await sendPodcastDiscardEmail(
                    emailEvent.email,
                    emailEvent.status,
                    emailEvent.title,
                    emailEvent.reason
                );
            }
            break;

        case EMAIL_EVENT_TYPES.CONTENT.ARTICLE_DISCARD_BY_ADMIN:

            if (emailEvent.email && emailEvent.title && emailEvent.reason) {
                await sendMailArticleDiscardByAdmin(
                    emailEvent.email,
                    emailEvent.title,
                    emailEvent.reason
                );
            }
            break;

        case EMAIL_EVENT_TYPES.CONTENT.EDIT_REQUEST_APPROVAL:

            if (emailEvent.email && emailEvent.title) {
                await sendMailOnEditRequestApproval(emailEvent.email, emailEvent.title);
            }
            break;

        case EMAIL_EVENT_TYPES.CONTENT.PICK_ARTICLE:
            if (emailEvent.email && emailEvent.title) {
                await pickArticleMail(emailEvent.email, emailEvent.title);
            }
            break;

        case EMAIL_EVENT_TYPES.CONTENT.PICK_PODCAST:

            if (emailEvent.email && emailEvent.title) {
                await pickPodcastMail(emailEvent.email, emailEvent.title);
            }
            break;

        // Batch Processing
        // case EMAIL_EVENT_TYPES.CONTENT.NEW_ARTICLE_PUBLISHED:
        //     // New Article Published, mail to every follower and subscribers
        //     if (
        //         emailEvent.email && emailEvent.title
        //         && emailEvent.authorName && emailEvent.articleLink
        //     ) {

        //         await
        //             sendNewArticleEmail(
        //                 emailEvent.email,
        //                 emailEvent.title,
        //                 emailEvent.authorName,
        //                 emailEvent.articleLink
        //             );
        //     }
        //     break;

        case EMAIL_EVENT_TYPES.CONTENT.ARTICLE_FEEDBACK:

            if (emailEvent.email && emailEvent.title && emailEvent.feedback) {
                await sendArticleFeedbackEmail(emailEvent.email, emailEvent.feedback, emailEvent.title);
            }
            break;

        default:
            console.log("Event not found");

    }
}

const handleContentModerationEmailEvent = async (emailEvent) => {

    console.log("Handling Content Moderation Mail Event", emailEvent);

    switch (emailEvent.groupIndex) {

        case EMAIL_EVENT_TYPES.MODERATION.REPORT_UNDERTAKEN:
            if (emailEvent.email && emailEvent.issueNumber) {
                await sendReportUndertakenEmail(emailEvent.email, emailEvent.issueNumber);
            }
            break;

        case EMAIL_EVENT_TYPES.MODERATION.INITIAL_REPORT_VICTIM:
            if (emailEvent.email) {
                await sendInitialReportMailtoVictim(emailEvent.email);
            }
            break;

        case EMAIL_EVENT_TYPES.MODERATION.INITIAL_REPORT_CONVICT:
            if (emailEvent.email && emailEvent.details && emailEvent.reportType) {
                await sendInitialReportMailtoConvict(
                    emailEvent.email,
                    emailEvent.details,
                    emailEvent.reportType
                );
            }
            break;

        case EMAIL_EVENT_TYPES.MODERATION.RESOLVED_VICTIM:
            if (
                emailEvent.email &&
                emailEvent.details &&
                emailEvent.reportType &&
                emailEvent.resolution
            ) {
                await sendResolvedMailToVictim(
                    emailEvent.email,
                    emailEvent.details,
                    emailEvent.reportType,
                    emailEvent.resolution
                );
            }
            break;

        case EMAIL_EVENT_TYPES.MODERATION.RESOLVED_CONVICT:
            if (
                emailEvent.email
                && emailEvent.details
                && emailEvent.reportType
            ) {
                await sendResolvedMailToConvict(
                    emailEvent.email,
                    emailEvent.details,
                    emailEvent.reportType
                );
            }
            break;

        case EMAIL_EVENT_TYPES.MODERATION.WARNING_VICTIM_DISMISS:
            if (
                emailEvent.email &&
                emailEvent.details &&
                emailEvent.reportType &&
                emailEvent.dismissReason &&
                emailEvent.misuseCount
            ) {

                await sendWarningMailToVictimOnReportDismissOrIgnore(
                    emailEvent.email,
                    emailEvent.details,
                    emailEvent.reportType,
                    emailEvent.dismissReason,
                    emailEvent.misuseCount
                );
            }
            break;

        case EMAIL_EVENT_TYPES.MODERATION.DISMISSED_CONVICT:

            if (emailEvent.email && emailEvent.details && emailEvent.reportType) {
                await sendDismissedOrIgnoreMailToConvict(
                    emailEvent.email,
                    emailEvent.details,
                    emailEvent.reportType
                );
            }
            break;

        case EMAIL_EVENT_TYPES.MODERATION.WARNING_CONVICT:
            if (
                emailEvent.email
                && emailEvent.details
                && emailEvent.reportType
                && emailEvent.reason
                && emailEvent.strikeCount
            ) {
                await sendWarningMailToConvict(
                    emailEvent.email,
                    emailEvent.details,
                    emailEvent.reportType,
                    emailEvent.reason,
                    emailEvent.strikeCount
                );
            }

            break;

        case EMAIL_EVENT_TYPES.MODERATION.REMOVE_CONTENT_CONVICT:
            if (
                emailEvent.email
                && emailEvent.details
                && emailEvent.reportType
                && emailEvent.reason
            ) {
                await sendRemoveContentMailToConvict(
                    emailEvent.email,
                    emailEvent.details,
                    emailEvent.reportType,
                    emailEvent.reason,
                );
            }

            break;

        case EMAIL_EVENT_TYPES.MODERATION.BLOCK_CONVICT:

            if (
                emailEvent.email
                && emailEvent.details
                && emailEvent.reportType
                && emailEvent.reason
            ) {
                await sendBlockConvictMail(
                    emailEvent.email,
                    emailEvent.details,
                    emailEvent.reportType,
                    emailEvent.reason,
                );
            }

            break;

        case EMAIL_EVENT_TYPES.MODERATION.BANNED_USER:
            if (
                emailEvent.email
                && emailEvent.details
                && emailEvent.reportType
                && emailEvent.reason
            ) {
                await sendBannedUserMail(
                    emailEvent.email,
                    emailEvent.details,
                    emailEvent.reportType,
                    emailEvent.reason,
                );
            }

            break;

        default:
            console.log("Event not found");
    }
}

const handleAccountModerationEmailEvent = async (emailEvent) => {
    console.log("Handling Account Moderation Mail Event", emailEvent);

    switch (emailEvent.groupIndex) {

        case EMAIL_EVENT_TYPES.ACCOUNT.UNBLOCK_USER:
            if (emailEvent.email && emailEvent.details) {
                await sendUnblockUserMail(emailEvent.email, emailEvent.details.user_name);
            }
            break;

        case EMAIL_EVENT_TYPES.ACCOUNT.RESTORE_CONTENT:
            if (emailEvent.email && emailEvent.details?.contentTitle) {
                await sendRestoreContentMailToUser(emailEvent.email, emailEvent.details?.contentTitle);
            }
            break;

        case EMAIL_EVENT_TYPES.ACCOUNT.RESTORE_REQUEST_RECEIVED:
            if (emailEvent.email && emailEvent.details?.contentTitle) {
                await sendRestoreRequestReceivedMail(emailEvent.email, emailEvent.details?.contentTitle);
            }
            break;

        case EMAIL_EVENT_TYPES.ACCOUNT.RESTORE_REQUEST_DISAPPROVED:
            if (emailEvent.email && emailEvent.details?.contentTitle) {
                await sendRestoreRequestDisapprovedMail(emailEvent.email, emailEvent.details?.contentTitle);
            }
            break;

        default:
            console.log("Topic not found");

    }
}

const handleSupportEmailEvent = async (emailEvent) => {
    console.log("Handle Support mail event", emailEvent);

    switch (emailEvent.groupIndex) {

        case EMAIL_EVENT_TYPES.SUPPORT.CONTACT_US:
            if (emailEvent.email && emailEvent.details) {

                await sendContactUsMail({
                    email: emailEvent.email,
                    name: emailEvent.details.name,
                    subject: emailEvent.details.subject,
                    message: emailEvent.details.message
                });
            }

            break;

        default:
            console.log("Topic not found");

    }
}

module.exports = {
    handleEmailEvent
}