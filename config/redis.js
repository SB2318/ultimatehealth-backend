const Redis = require("ioredis");

const redisHost = process.env.REDIS_HOST || (process.env.NODE_ENV === "production" ? "redis" : "127.0.0.1");

const redis = new Redis({
  host: redisHost,
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 20) {
      console.warn("⚠️ Redis max reconnection attempts reached. Continuing with in-memory fallback.");
      return null;
    }
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

redis.on("connect", () => console.log("✅ Redis connected successfully"));
redis.on("error", (err) => console.error("❌ Redis Connection Error:", err.message));

module.exports = redis;
