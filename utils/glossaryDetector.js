const Glossary = require('../models/Glossary');
const { getHTMLFileContent } = require('./pocketbaseUtil');

let glossaryCache = {
  lookupMap: new Map(),
  maxPhraseLength: 1,
  lastUpdated: 0,
};

const CACHE_TTL_MS = 10 * 60 * 1000;

const extractPlainTextFromHTML = (htmlString) => {
  if (!htmlString || typeof htmlString !== 'string') return '';
  return htmlString
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const refreshGlossaryCache = async (force = false) => {
  const now = Date.now();
  if (!force && glossaryCache.lastUpdated && (now - glossaryCache.lastUpdated < CACHE_TTL_MS)) {
    return glossaryCache;
  }

  const glossaryList = await Glossary.find(
    { status: 'published' },
    '_id term synonyms slug shortDescription'
  ).lean();

  const lookupMap = new Map();
  let maxPhraseLength = 1;

  for (const item of glossaryList) {
    const keywords = [item.term, ...(item.synonyms || [])].filter(Boolean);

    for (const kw of keywords) {
      const normalized = kw.trim().toLowerCase();
      if (normalized.length < 2) continue;

      const wordCount = normalized.split(/\s+/).length;
      if (wordCount > maxPhraseLength) {
        maxPhraseLength = wordCount;
      }

      if (!lookupMap.has(normalized)) {
        lookupMap.set(normalized, {
          _id: item._id,
          term: item.term,
          slug: item.slug,
          shortDescription: item.shortDescription,
        });
      }
    }
  }

  glossaryCache = {
    lookupMap,
    maxPhraseLength: Math.min(maxPhraseLength, 5),
    lastUpdated: now,
  };

  return glossaryCache;
};

const detectGlossaryTerms = async (textToScan) => {
  if (!textToScan || typeof textToScan !== 'string' || textToScan.trim() === '') {
    return { glossaryIds: [], matchedTerms: [] };
  }

  const { lookupMap, maxPhraseLength } = await refreshGlossaryCache();
  if (lookupMap.size === 0) {
    return { glossaryIds: [], matchedTerms: [] };
  }

  const words = textToScan
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const totalWords = words.length;
  const detectedMap = new Map();

  for (let i = 0; i < totalWords; i++) {
    for (let len = maxPhraseLength; len >= 1; len--) {
      if (i + len > totalWords) continue;

      const phrase = words.slice(i, i + len).join(' ');
      const match = lookupMap.get(phrase);

      if (match) {
        const key = match._id.toString();
        if (!detectedMap.has(key)) {
          detectedMap.set(key, {
            _id: match._id,
            term: match.term,
            matchedKeyword: phrase,
            slug: match.slug,
            shortDescription: match.shortDescription,
          });
        }
      }
    }
  }

  const matchedTerms = Array.from(detectedMap.values());
  const glossaryIds = matchedTerms.map(t => t._id);

  return { glossaryIds, matchedTerms };
};

const detectGlossaryForArticle = async ({ pb_recordId, content, title, description, summary }) => {
  let fileText = '';

  if (pb_recordId) {
    try {
      const fileData = await getHTMLFileContent('content', pb_recordId);
      if (fileData && fileData.htmlContent) {
        fileText = extractPlainTextFromHTML(fileData.htmlContent);
      }
    } catch (err) {
      console.warn(`[GlossaryDetector] Failed to load PocketBase record (${pb_recordId}):`, err.message);
    }
  }

  const inlineContentText = extractPlainTextFromHTML(content);

  const combinedText = [
    title || '',
    description || '',
    summary || '',
    inlineContentText,
    fileText,
  ].join(' ');

  return await detectGlossaryTerms(combinedText);
};

const invalidateGlossaryCache = () => {
  glossaryCache.lastUpdated = 0;
};

module.exports = {
  extractPlainTextFromHTML,
  detectGlossaryTerms,
  detectGlossaryForArticle,
  refreshGlossaryCache,
  invalidateGlossaryCache,
};
