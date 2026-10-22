const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Glossary = require('../models/Glossary');
const ArticleTag = require('../models/ArticleModel');
const { statusEnum } = require('../utils/StatusEnum');

async function seedGlossaryData() {
  const jsonPath = path.join(__dirname, 'glossaryData.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('Data file not found:', jsonPath);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${rawData.length} raw term records from user upload.`);

  // 1. Group by unique slug (lowercase) and merge multiple categories / related terms
  const mergedMap = new Map();

  for (const item of rawData) {
    if (!item.slug || !item.term) continue;
    const cleanSlug = item.slug.trim().toLowerCase();

    if (!mergedMap.has(cleanSlug)) {
      mergedMap.set(cleanSlug, {
        term: item.term.trim(),
        slug: cleanSlug,
        definition: (item.definition || '').trim(),
        language: item.language || 'en-IN',
        categories: new Set(),
        related_terms: new Set(),
        is_published: item.is_published !== undefined ? item.is_published : true,
      });
    }

    const entry = mergedMap.get(cleanSlug);
    if (item.category && item.category.trim()) {
      entry.categories.add(item.category.trim());
    }
    if (Array.isArray(item.related_terms)) {
      item.related_terms.forEach((rt) => {
        if (typeof rt === 'string' && rt.trim()) entry.related_terms.add(rt.trim());
      });
    }
    if (Array.isArray(item.synonyms)) {
      item.synonyms.forEach((syn) => {
        if (typeof syn === 'string' && syn.trim()) entry.related_terms.add(syn.trim());
      });
    }
  }

  const uniqueTerms = Array.from(mergedMap.values());
  console.log(`Successfully merged into ${uniqueTerms.length} completely unique glossary terms (zero duplication).`);

  // 2. Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URL, {
    serverSelectionTimeoutMS: 20000,
  });
  console.log('Connected to MongoDB.');

  // Find system author
  const systemUser =
    (await mongoose.connection.collection('users').findOne({ email: 'sb2318@it.jgec.ac.in' })) ||
    (await mongoose.connection.collection('users').findOne({})) ||
    null;

  const authorId = systemUser ? systemUser._id : null;
  console.log('Assigning authorId:', authorId);

  // 3. Ensure Category Tags exist in ArticleTag collection
  const allCategoryNames = new Set();
  uniqueTerms.forEach((t) => t.categories.forEach((c) => allCategoryNames.add(c)));

  console.log(`Ensuring ${allCategoryNames.size} categories in ArticleTag collection...`);

  const categoryTagMap = new Map();
  for (const catName of allCategoryNames) {
    let tag = await ArticleTag.findOne({ name: new RegExp(`^${catName}$`, 'i') });
    if (!tag) {
      const maxTag = await ArticleTag.findOne().sort({ id: -1 }).lean();
      const nextId = maxTag && typeof maxTag.id === 'number' ? maxTag.id + 1 : 1;
      tag = await ArticleTag.create({
        id: nextId,
        name: catName,
      });
      console.log(`Created ArticleTag: "${catName}" (id: ${nextId})`);
    }
    categoryTagMap.set(catName.toLowerCase(), tag._id);
  }

  // 4. Upsert into MongoDB Glossary Collection
  let insertedCount = 0;
  let updatedCount = 0;

  for (const item of uniqueTerms) {
    const categoryIds = Array.from(item.categories)
      .map((c) => categoryTagMap.get(c.toLowerCase()))
      .filter(Boolean);

    const synonyms = Array.from(item.related_terms);

    const doc = {
      term: item.term,
      slug: item.slug,
      language: item.language,
      definition: item.definition,
      shortDescription: item.definition.slice(0, 150),
      synonyms,
      categories: categoryIds,
      status: item.is_published ? statusEnum.PUBLISHED : statusEnum.UNASSIGNED,
      is_removed: false,
    };

    if (authorId) {
      doc.authorId = authorId;
    }

    const existing = await Glossary.findOne({ slug: item.slug });
    if (existing) {
      await Glossary.updateOne({ slug: item.slug }, { $set: doc });
      updatedCount++;
    } else {
      await Glossary.create(doc);
      insertedCount++;
    }
  }

  const totalInDb = await Glossary.countDocuments({ is_removed: false });
  console.log('\n--- Ingestion Finished Successfully ---');
  console.log(`- New terms inserted: ${insertedCount}`);
  console.log(`- Existing terms updated: ${updatedCount}`);
  console.log(`- Total unique glossary terms in MongoDB: ${totalInDb}`);

  // Print language breakdown
  const enCount = await Glossary.countDocuments({ language: /^en/i, is_removed: false });
  const hiCount = await Glossary.countDocuments({ language: 'hi', is_removed: false });
  const bnCount = await Glossary.countDocuments({ language: 'bn', is_removed: false });
  console.log(`- Language breakdown: English: ${enCount}, Hindi: ${hiCount}, Bengali: ${bnCount}`);

  await mongoose.disconnect();
  console.log('MongoDB connection closed.');
}

seedGlossaryData().catch((err) => {
  console.error('Fatal Seed Error:', err);
  process.exit(1);
});
