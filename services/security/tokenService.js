const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const redis = require("../../config/redis");
const { throwError } = require("../../utils/throwError");
const { HTTP_STATUS, ERROR_CODES } = require("../../constants/errorConstants");
require("dotenv").config();

const ISSUER = 'ultimate-health';
const AUDIENCE = 'ultimate-health-users';

let privateKey, publicKey;

const loadKeys = () => {
    try {
        if (process.env.JWT_PRIVATE_KEY) {
            privateKey = process.env.JWT_PRIVATE_KEY.replace(/\\n/g, "\n");
        } else {
            const privatePath = path.join(__dirname, "../../keys/private.pem");
            if (fs.existsSync(privatePath)) {
                privateKey = fs.readFileSync(privatePath, "utf8");
            }
        }

        if (process.env.JWT_PUBLIC_KEY) {
            publicKey = process.env.JWT_PUBLIC_KEY.replace(/\\n/g, "\n");
        } else {
            const publicPath = path.join(__dirname, "../../keys/public.pem");
            if (fs.existsSync(publicPath)) {
                publicKey = fs.readFileSync(publicPath, "utf8");
            }
        }
    } catch (err) {
        console.warn("⚠️ Warning: RS256 Key Pair load error. Fallback to HS256 secrets if defined.");
    }
};

loadKeys();

const getSignSecret = (type = "access") => {
    if (privateKey) return { key: privateKey, algorithm: "RS256" };
    
    if (type === "access") return { key: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "fallback_access_secret", algorithm: "HS256" };
    if (type === "refresh") return { key: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "fallback_refresh_secret", algorithm: "HS256" };
    if (type === "verification") return { key: process.env.JWT_VERIFICATION_SECRET || process.env.JWT_SECRET || "fallback_verification_secret", algorithm: "HS256" };
    return { key: process.env.JWT_SECRET || "fallback_secret", algorithm: "HS256" };
};

const getVerifySecret = (type = "access") => {
    if (publicKey) return { key: publicKey, algorithm: "RS256" };
    return getSignSecret(type);
};

const generateJti = () => crypto.randomUUID();

const generateAccessToken = (payload, expiresIn) => {
    const expiry = expiresIn || process.env.JWT_ACCESS_EXPIRY || "15m";
    const { key, algorithm } = getSignSecret("access");

    const jti = generateJti();
    const accessToken = jwt.sign(
        { ...payload, type: "access", jti },
        key,
        { algorithm, issuer: ISSUER, audience: AUDIENCE, expiresIn: expiry }
    );

    return { accessToken, jti };
};

const generateRefreshToken = async (userId, payload = {}, expiresIn) => {
    const { key, algorithm } = getSignSecret("refresh");
    const expiry = expiresIn || process.env.JWT_REFRESH_EXPIRY || "7d";
    const jti = generateJti();

    const refreshTokenPayload = {
        ...payload,
        userId: userId || payload.userId,
        type: "refresh",
        jti,
    };

    const refreshToken = jwt.sign(
        refreshTokenPayload,
        key,
        { algorithm, issuer: ISSUER, audience: AUDIENCE, expiresIn: expiry }
    );

    const ttlSeconds = 7 * 24 * 60 * 60;
    try {
        await redis.setex(`refresh_token:${userId || payload.userId}:${jti}`, ttlSeconds, "active");
    } catch (e) {
        console.warn("⚠️ Redis unavailable, skipping refresh token storage");
    }

    return { refreshToken, jti };
};

const generateVerificationToken = (payload, expiresIn) => {
    const { key, algorithm } = getSignSecret("verification");
    const expiry = expiresIn || process.env.JWT_VERIFICATION_EXPIRY || "1h";
    const jti = generateJti();

    const verificationPayload = {
        ...payload,
        type: "email_verification",
        jti,
    };

    const verificationToken = jwt.sign(
        verificationPayload,
        key,
        { algorithm, issuer: ISSUER, audience: AUDIENCE, expiresIn: expiry }
    );

    return { verificationToken, jti };
};

const verifyAccessToken = async (token) => {
    try {
        const { key, algorithm } = getVerifySecret("access");
        const decoded = jwt.verify(token, key, {
            algorithms: [algorithm],
            issuer: ISSUER,
            audience: AUDIENCE,
        });

        try {
            const isBlacklisted = await redis.exists(`blacklist:${decoded.jti}`);
            if (isBlacklisted) {
                throwError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.ACCESS_DENIED, "Token has been revoked");
            }

            const currentVersion = await redis.get(`user_token_version:${decoded.userId}`);
            if (currentVersion && decoded.tokenVersion !== undefined && decoded.tokenVersion !== parseInt(currentVersion, 10)) {
                throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Session expired");
            }
        } catch (e) {
            if (e.status) throw e;
        }

        return decoded;
    } catch (err) {
        if (err.status) throw err;
        throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Invalid or expired access token");
    }
};

const verifyRefreshToken = async (token) => {
    try {
        const { key, algorithm } = getVerifySecret("refresh");
        const decoded = jwt.verify(token, key, {
            algorithms: [algorithm],
            issuer: ISSUER,
            audience: AUDIENCE,
        });

        if (!decoded || decoded.type !== "refresh") {
            throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, 'Invalid token type');
        }

        try {
            const exists = await redis.exists(`refresh_token:${decoded.userId}:${decoded.jti}`);
            if (!exists) {
                // If Redis has records, enforce check
                const keys = await redis.keys(`refresh_token:${decoded.userId}:*`);
                if (keys.length > 0) {
                    throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Refresh token revoked or used");
                }
            }
        } catch (e) {
            if (e.status) throw e;
        }

        return decoded;
    } catch (err) {
        if (err.status) throw err;
        throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Invalid or expired refresh token");
    }
};

const verifyVerificationToken = (token) => {
    try {
        const { key, algorithm } = getVerifySecret("verification");
        const decoded = jwt.verify(token, key, {
            algorithms: [algorithm],
            issuer: ISSUER,
            audience: AUDIENCE,
        });
        if (!decoded || decoded.type !== "email_verification") {
            throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, 'Invalid or expired verification token');
        }
        return decoded;
    } catch (error) {
        throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Invalid or expired token");
    }
};

const revokeRefreshToken = async (userId, jti) => {
    try {
        await redis.del(`refresh_token:${userId}:${jti}`);
    } catch (e) {
        console.warn("⚠️ Redis unavailable, skipping refresh token revocation");
    }
};

const blacklistAccessToken = async (jti, expTimestampSeconds) => {
    try {
        const ttl = expTimestampSeconds ? expTimestampSeconds - Math.floor(Date.now() / 1000) : 900;
        if (ttl > 0) {
            await redis.setex(`blacklist:${jti}`, ttl, "revoked");
        }
    } catch (e) {
        console.warn("⚠️ Redis unavailable, skipping token blacklisting");
    }
};

const revokeAllUserTokens = async (userId) => {
    try {
        await redis.incr(`user_token_version:${userId}`);
        const keys = await redis.keys(`refresh_token:${userId}:*`);
        if (keys.length > 0) {
            await redis.del(keys);
        }
    } catch (e) {
        console.warn("⚠️ Redis unavailable, skipping user token version increment");
    }
};

const verifyToken = (token) => {
    const { key, algorithm } = getVerifySecret("access");
    return jwt.verify(token, key, { algorithms: [algorithm] });
};

const hashToken = (token) => {
    const secret = process.env.TOKEN_SECRET || "fallback_default_secret_key_123";
    return crypto
        .createHmac('sha256', secret)
        .update(token)
        .digest('hex');
};

const generateOtp = () => {
    return crypto.randomInt(100000, 1000000).toString();
};

const verifyOtp = (inputOtp, hashedOtp) => {
    const inputHashed = hashToken(inputOtp);
    return inputHashed === hashedOtp;
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    generateVerificationToken,
    generateOtp,
    verifyOtp,
    verifyAccessToken,
    verifyRefreshToken,
    verifyVerificationToken,
    revokeRefreshToken,
    blacklistAccessToken,
    revokeAllUserTokens,
    verifyToken,
    hashToken
};