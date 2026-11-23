const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
require('dotenv').config();

const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const streamPodcast = async (req, res) => {
    const { key } = req.params;
    const { expires, signature } = req.query;

    if (!key || !expires || !signature) {
        return res.status(400).json({ message: 'Missing required parameters for streaming' });
    }

    // Check expiration
    if (Date.now() > parseInt(expires, 10)) {
        return res.status(403).json({ message: 'Streaming URL has expired' });
    }

    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const secret = process.env.JWT_SECRET || 'ultimate_health_secret';

    const dataToSign = `${key}:${expires}:${ip}:${userAgent}`;
    const expectedSignature = crypto.createHmac('sha256', secret)
        .update(dataToSign)
        .digest('hex');

    if (signature !== expectedSignature) {
        return res.status(403).json({ message: 'Invalid signature or unauthorized client fingerprint' });
    }

    const params = {
        Bucket: 'ultimate-health-new',
        Key: key,
    };

    const command = new GetObjectCommand(params);

    try {
        const data = await s3Client.send(command);
        
        // Enforce CORS policies for secure streaming as requested
        res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
        res.setHeader('Content-Type', data.ContentType);
        
        data.Body.pipe(res);
    } catch (err) {
        console.error("Error fetching podcast stream:", err);
        return res.status(404).json({ message: 'File not found' });
    }
};

module.exports = {
    streamPodcast
};
