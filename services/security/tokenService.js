const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { throwError } = require("../../utils/throwError");
const { HTTP_STATUS, ERROR_CODES } = require("../../constants/errorConstants");
require("dotenv").config();
const redis = require("../../config/redis");



let privateKey, publicKey;

try {
    privateKey = process.env.JWT_PRIVATE_KEY
        ? process.env.JWT_PRIVATE_KEY.replace(/\\n/g, "\n")
        : fs.readFileSync(path.join(__dirname, "../../keys/private.pem"), "utf8");
    publicKey = process.env.JWT_PUBLIC_KEY
        ? process.env.JWT_PUBLIC_KEY.replace(/\\n/g, "\n")
        : fs.readFileSync(path.join(__dirname, "../../keys/public.pem"), "utf8");
} catch (err) {
    console.error("Failed to load RS256 Key Pair from keys/ directory or environment variables.");
}

const ISSUER = 'ultimate-health';
const AUDIENCE = 'ultimate-health-users';

const baseOptions = {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'RS256',
};

const generateJti = () => crypto.randomUUID();

const generateAccessToken = (payload, expiresIn) => {
    const jti = generateJti();
    const expiry = expiresIn || process.env.JWT_ACCESS_EXPIRY || "15m";
    //const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

    const accessToken = jwt.sign(
        { ...payload, type: "access", jti },
        privateKey,
        { algorithm: 'RS256', issuer: ISSUER, audience: AUDIENCE, expiresIn: expiry }
    );

    return accessToken;
}


const generateRefreshToken = (payload, expiresIn) => {
    const jti = generateJti();
    //const secret = process.env.JWT_REFRESH_SECRET;
 
    const expiry =
        expiresIn ??
        process.env.JWT_REFRESH_EXPIRY ??
        "7d";
    if (!expiry) {
        throwError(HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, "Something went wrong. Please try again later.");

    }

    const refreshTokenPayload = {
        ...payload,
        type: "refresh",
        jti,
    };
    const refreshToken = jwt.sign(
        refreshTokenPayload,
        privateKey,
        { ...baseOptions, expiresIn: expiry }
    );

    return { refreshToken, jti: refreshTokenPayload.jti };
}

const generateVerificationToken = (payload, expiresIn) => {
    //const secret = process.env.JWT_VERIFICATION_SECRET;
 
    const expiry =
        expiresIn ??
        process.env.JWT_VERIFICATION_EXPIRY ??
        "1h";

    if (!expiry) {
        throwError(HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, "Something went wrong. Please try again later.");

    }

    const verificationPayload = {
        ...payload,
        type: "email_verification",
        jti: generateJti(),
    };


    const verificationToken = jwt.sign(
        verificationPayload,
        privateKey,
        { ...baseOptions, expiresIn: expiry }
    );

    return { verificationToken, jti: verificationPayload.jti };
}

const verifyAccessToken = async (token) => {

    try {
        const decoded = jwt.verify(token, publicKey, {
            algorithms: ["RS256"],
            issuer: ISSUER,
            audience: AUDIENCE,
        });

        if (decoded.type !== "access") {
            throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Invalid token type");
        }

        const isBlacklisted = await redis.exists(`blacklist:${decoded.jti}`);

        if (isBlacklisted) {
            throwError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.ACCESS_DENIED, "Token has been revoked");
        }

        const currentVersion = await redis.get(`user_token_version:${decoded.userId}`);

        if (currentVersion && decoded.tokenVersion !== parseInt(currentVersion, 10)) {
            throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Session expired");
        }
        return decoded;

    } catch (err) {
        if (err.name === "TokenExpiredError") {
            throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Token has expired");
        } else if (err.name === "JsonWebTokenError") {
            throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Invalid token");
        }
        else {
            throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Invalid or expired token");
        }
    }
}

const verifyRefreshToken = async (token) => {
    try {

        const decoded = jwt.verify(token, publicKey, {
            issuer: ISSUER,
            audience: AUDIENCE,
            algorithms: ["RS256"]
        });
        if (!decoded || decoded.type !== "refresh") {
            throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, 'Invalid or expired verification token');
        }

        const exists = await redis.exists(`refresh_token:${decoded.userId}:${decoded.jti}`);
        if (!exists) {
            throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Refresh token is invalid or used");
        }

        return decoded;
    } catch (err) {
        throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Invalid or expired token");
    }

}

const verifyVerificationToken = async (token) => {
    try {
    
        const decoded =  jwt.verify(token, publicKey, {
            issuer: ISSUER,
            audience: AUDIENCE,
            algorithms: ["RS256"]
        });
        if (!decoded || decoded.type !== "email_verification") {
            throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, 'Invalid or expired verification token');
        }
        return decoded;
    } catch (error) {
        throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Invalid or expired token");

    }

}


const revokeRefreshToken = async (userId, jti) => {
  await redis.del(`refresh_token:${userId}:${jti}`);
};

const blacklistAccessToken = async (jti, expTimestampSeconds) => {
  const ttl = expTimestampSeconds - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.setex(`blacklist:${jti}`, ttl, "revoked");
  }
};
const revokeAllUserTokens = async (userId) => {
  await redis.incr(`user_token_version:${userId}`);
  const keys = await redis.keys(`refresh_token:${userId}:*`);
  if (keys.length > 0) {
    await redis.del(keys);
  }
};


const verifyToken = (token) => {
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    return decoded;
}




const hashToken = (token) => {
    const secret = process.env.TOKEN_SECRET || "fallback_default_secret_key_123";
    return crypto
        .createHmac('sha256', secret)
        .update(token)
        .digest('hex');
};

const generateOtp = () => {
    return crypto.randomInt(100000, 1000000).toString(); // 6 digit OTP
}

const verifyOtp = (inputOtp, hashedOtp) => {
    const inputHashed = hashToken(inputOtp);
    return inputHashed === hashedOtp;
}

module.exports = {
    // Generation functions
    generateAccessToken,
    generateRefreshToken,
    generateVerificationToken,
    generateOtp,
    verifyOtp,

    // Verification functions
    verifyAccessToken,
    verifyRefreshToken,
    verifyVerificationToken,

    // Legacy (backward compatibility)
    verifyToken,

    // hash token
    hashToken,

    revokeRefreshToken,
    blacklistAccessToken,
    revokeAllUserTokens

}