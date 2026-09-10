
const requiredEnvVars = [
    'MONGODB_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_VERIFICATION_SECRET',
];

const recommendedEnvVars = [
    'PORT',
    'NODE_ENV',
    'TOKEN_SECRET',
    'EMAIL_USER',
    'EMAIL_PASS',
    'SMTP_HOST',
    'VULTR_ACCESS_KEY',
    'VULTR_SECRET_KEY',
    'BUCKET_NAME',
    'ENDPOINT_URL',
    'GEMINI_API_KEY_1',
];

const validateEnv = () => {

    const missingRequired = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingRequired.length > 0) {
        console.log("Critical Configuration Error: Missing required environment variables");

        missingRequired.forEach((value) => {
            console.error(`Please configure the secret: ${value}`);
        });

        if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
        }
    }

    const missingRecommended = recommendedEnvVars.filter((varName) => !process.env[varName]);

    if (missingRecommended.length > 0 && process.env.NODE_ENV !== 'test') {
        console.warn('⚠️ WARNING: Recommended environment variables are missing:');
        missingRecommended.forEach((varName) => console.warn(`   - ${varName}`));
    }

}

// perform verification on load
validateEnv();

module.exports = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 8080,
    MONGODB_URL: process.env.MONGODB_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_VERIFICATION_SECRET: process.env.JWT_VERIFICATION_SECRET,
    TOKEN_SECRET: process.env.TOKEN_SECRET,
    validateEnv,
}