const Glossary = require('../models/Glossary');

let glossaryCache = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

function extractPlainText(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadGlossaryCache() {
  if (glossaryCache && Date.now() < cacheExpiresAt) {
    return glossaryCache;
  }

  const terms = await Glossary.find({ status: 'published' })
    .select('_id term slug synonyms shortDescription')
    .lean();

  const map = new Map();

  for (const entry of terms) {
    const key = entry.term.toLowerCase();
    if (!map.has(key)) map.set(key, entry);

    for (const synonym of entry.synonyms || []) {
      const skey = synonym.toLowerCase();
      if (!map.has(skey)) map.set(skey, entry);
    }
  }

  glossaryCache = map;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return map;
}

function invalidateCache() {
  glossaryCache = null;
  cacheExpiresAt = 0;
}

async function matchGlossaryTerms(plainText) {
  const termMap = await loadGlossaryCache();
  const matched = new Map();
  const lower = plainText.toLowerCase();
  const words = lower.split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    for (let len = 1; len <= 5 && i + len <= words.length; len++) {
      const phrase = words.slice(i, i + len).join(' ');
      const entry = termMap.get(phrase);
      if (entry && !matched.has(entry._id.toString())) {
        matched.set(entry._id.toString(), {
          _id: entry._id,
          term: entry.term,
          slug: entry.slug,
          shortDescription: entry.shortDescription,
        });
      }
    }
  }

  return Array.from(matched.values());
}

module.exports = { extractPlainText, matchGlossaryTerms, invalidateCache };
