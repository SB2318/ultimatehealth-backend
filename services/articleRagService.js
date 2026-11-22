const Article = require('../models/Articles');

const STOPWORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
    'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
    'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could',
    'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down',
    'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has',
    'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her',
    'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
    'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it',
    'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my',
    'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
    'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t',
    'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some',
    'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves',
    'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
    'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up',
    'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were',
    'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which',
    'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would',
    'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours',
    'yourself', 'yourselves', 'tell', 'need', 'help', 'give', 'know', 'want'
]);

function extractKeywords(queryText) {
    if (!queryText || typeof queryText !== 'string') return [];
    
    return queryText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function scoreArticle(article, keywords) {
    let score = 0;
    const titleLower = (article.title || '').toLowerCase();
    const descLower = (article.description || '').toLowerCase();
    const summaryLower = (article.summary || '').toLowerCase();

    for (const kw of keywords) {
        if (titleLower.includes(kw)) {
            score += 5;
        }
        if (descLower.includes(kw)) {
            score += 2;
        }
        if (summaryLower.includes(kw)) {
            score += 2;
        }
    }

    return score;
}

async function findRelevantArticles(queryText, limit = 2) {
    try {
        const keywords = extractKeywords(queryText);
        if (keywords.length === 0) return [];

        const regexes = keywords.map(w => new RegExp(w, 'i'));

        const candidates = await Article.find({
            $or: [
                { title: { $in: regexes } },
                { description: { $in: regexes } },
                { summary: { $in: regexes } }
            ]
        })
        .select('_id pb_recordId title description summary publishedDate')
        .limit(20)
        .lean();

        if (!candidates || candidates.length === 0) {
            return [];
        }

        const scored = candidates
            .map(art => ({
                article: art,
                score: scoreArticle(art, keywords)
            }))
            .filter(item => item.score >= 4)
            .sort((a, b) => b.score - a.score);

        const topScore = scored.length > 0 ? scored[0].score : 0;
        const filtered = scored
            .filter(item => item.score >= (topScore * 0.5))
            .slice(0, limit);

        return filtered.map(({ article }) => {
            const articlePath = article.pb_recordId || article._id;
            return {
                id: article._id,
                pb_recordId: article.pb_recordId,
                title: article.title,
                summary: (article.summary || article.description || '').replace(/\s+/g, ' ').trim(),
                url: `https://ultimatehealth.blog/web/en/articles/${articlePath}`
            };
        });
    } catch (err) {
        console.warn('findRelevantArticles error:', err.message);
        return [];
    }
}

function formatArticlesForPrompt(articles) {
    if (!articles || articles.length === 0) return '';

    const lines = [
        '[VERIFIED ULTIMATEHEALTH CLINICAL ARTICLES]',
        'The following verified medical article(s) published on UltimateHealth match the user\'s inquiry:'
    ];

    articles.forEach((art, idx) => {
        lines.push(`${idx + 1}. Title: "${art.title}"`);
        lines.push(`   Link: ${art.url}`);
        lines.push(`   Summary: ${art.summary.slice(0, 350)}`);
    });

    lines.push('\nMANDATORY INSTRUCTIONS:');
    lines.push('1. Ground your response in the facts provided in the UltimateHealth article(s) above.');
    lines.push('2. You MUST provide the article link directly to the user (e.g. "For in-depth details, read our full article on UltimateHealth: [Article Title](URL)") in your response.');

    return lines.join('\n');
}

module.exports = {
    findRelevantArticles,
    formatArticlesForPrompt,
    extractKeywords
};
