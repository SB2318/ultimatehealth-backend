const mongoose = require("mongoose");

const dbConnect = async () => {
    const primaryUri = process.env.MONGODB_URL;
    const isProduction = (process.env.NODE_ENV || "").toLowerCase() === "production";

    if (!primaryUri) {
        if (isProduction) {
            console.error("❌ CRITICAL: MONGODB_URL is missing in production environment.");
            process.exit(1);
        }
    }

    try {
        await mongoose.connect(primaryUri || "mongodb://127.0.0.1:27017/ultimate_health", {
            serverSelectionTimeoutMS: 6000,
        });
        console.log("DB CONNECTION IS SUCCESSFUL (Primary)");
    } catch (error) {
        console.error("❌ Primary DB connection failed:", error.message);
        if (isProduction) {
            console.error("❌ Refusing insecure unauthenticated local fallback in production environment.");
            process.exit(1);
        }
        console.log("Attempting fallback to local development MongoDB (127.0.0.1:27017)...");
        try {
            const fallbackUri = process.env.FALLBACK_MONGODB_URL || "mongodb://127.0.0.1:27017/ultimate_health";
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


