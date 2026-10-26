const mongoose = require("mongoose");

const dbConnect = async () => {
    const primaryUri = process.env.MONGODB_URL;
    const fallbackUri = "mongodb://127.0.0.1:27017/ultimate_health";

    try {
        await mongoose.connect(primaryUri, {
            serverSelectionTimeoutMS: 6000,
        });
        console.log("DB CONNECTION IS SUCCESSFUL (Primary)");
    } catch (error) {
        console.warn("⚠️ Primary DB connection failed:", error.message);
        console.log("Attempting fallback to local MongoDB (127.0.0.1:27017)...");
        try {
            await mongoose.connect(fallbackUri, {
                serverSelectionTimeoutMS: 6000,
            });
            console.log("DB CONNECTION IS SUCCESSFUL (Local Fallback)");
        } catch (fallbackErr) {
            console.log('ISSUE IN DB CONNECTION');
            console.error(fallbackErr.message);
            process.exit(1);
        }
    }
};

module.exports = { dbConnect };


