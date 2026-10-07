const admin = require("firebase-admin");

var serviceAccount = require("../firebase-admin-sdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;