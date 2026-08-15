
const admin = require('../../config/firebase');

/**
 * Sends a push notification to a single device via Firebase Cloud Messaging.
 * This is used exclusively by notificationConsumer.js.
 * @param {string} deviceToken - The FCM device token.
 * @param {Object} message - The notification payload: { title, body }
 */
module.exports.sendPushNotification = (deviceToken, message) => {

    const payload = {
        notification: {
            title: message.title,
            body: message.body,
        },
    };

    admin.messaging()
        .send({
            token: deviceToken,
            notification: payload.notification,
        })
        .then(async (response) => {
            console.log("Successfully sent message:", response);
        })
        .catch((error) => {
            console.log("Error sending message:", error);
        });
};
