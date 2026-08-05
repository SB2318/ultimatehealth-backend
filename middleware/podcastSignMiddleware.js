const crypto = require('crypto');

const signPodcastUrlsMiddleware = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function (body) {
        if (typeof body === 'string') {
            const ip = req.ip || req.connection.remoteAddress || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            const secret = process.env.JWT_SECRET || 'ultimate_health_secret';

            // Regex to find "audio_url":"..." where the URL points to /api/getFile/<key>
            body = body.replace(/"audio_url":"(https?:\/\/[^"]+\/api\/getFile\/([^"]+))"/g, (match, fullUrl, key) => {
                const expires = Date.now() + 1000 * 60 * 60; // 1 hour expiration
                const dataToSign = `${key}:${expires}:${ip}:${userAgent}`;
                
                const signature = crypto.createHmac('sha256', secret)
                    .update(dataToSign)
                    .digest('hex');
                
                // Construct the new secure stream URL
                const newUrl = fullUrl.replace('/api/getFile/', '/api/podcast/stream/') + `?expires=${expires}&signature=${signature}`;
                
                return `"audio_url":"${newUrl}"`;
            });

            // Also cover cases where audio_url might be a relative path, e.g. "/api/getFile/..."
            body = body.replace(/"audio_url":"(\/api\/getFile\/([^"]+))"/g, (match, fullUrl, key) => {
                const expires = Date.now() + 1000 * 60 * 60; // 1 hour expiration
                const dataToSign = `${key}:${expires}:${ip}:${userAgent}`;
                
                const signature = crypto.createHmac('sha256', secret)
                    .update(dataToSign)
                    .digest('hex');
                
                const newUrl = fullUrl.replace('/api/getFile/', '/api/podcast/stream/') + `?expires=${expires}&signature=${signature}`;
                
                return `"audio_url":"${newUrl}"`;
            });
        }
        
        return originalSend.call(this, body);
    };
    
    next();
};

module.exports = signPodcastUrlsMiddleware;
