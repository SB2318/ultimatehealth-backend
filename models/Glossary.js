const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { statusEnum } = require('../utils/StatusEnum');

const glossarySchema = new Schema({
  term: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  language: {
    type: String,
    default: 'en-IN',
    trim: true,
    index: true,
  },
  synonyms: [{
    type: String,
    trim: true,
  }],
  shortDescription: {
    type: String,
    maxLength: 160,
    trim: true,
  },
  definition: {
    type: String,
    required: true,
    trim: true,
  },
  categories: [{
    type: Schema.Types.ObjectId,
    ref: 'ArticleTag',
    default: [],
  }],
  relatedTerms: [{
    type: Schema.Types.ObjectId,
    ref: 'Glossary',
    default: [],
  }],
  status: {
    type: String,
    enum: Object.values(statusEnum),
    default: statusEnum.UNASSIGNED,
    index: true,
  },
  authorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  reviewerId: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
    index: true,
  },
  feedback: {
    type: String,
    trim: true,
    default: '',
  },
  rejectionReason: {
    type: String,
    trim: true,
    default: '',
  },
  is_removed: {
    type: Boolean,
    default: false,
    index: true,
  },
}, {
  timestamps: true,
});

// Compound & text indexes for fast searching and review queues
glossarySchema.index(
  { term: 'text', synonyms: 'text', shortDescription: 'text', definition: 'text' },
  { weights: { term: 10, synonyms: 5, shortDescription: 2, definition: 1 }, name: 'GlossaryTextSearchIndex' }
);

// ESR Index: language + status + soft-deleted + alphabetical term sorting/searching
glossarySchema.index({ language: 1, status: 1, is_removed: 1, term: 1 });

// Reviewer workflow queue index: status + reviewerId + creation date
glossarySchema.index({ status: 1, reviewerId: 1, createdAt: -1 });

// Category filtering index
glossarySchema.index({ categories: 1, language: 1, status: 1 });

const Glossary = mongoose.model('Glossary', glossarySchema);

module.exports = Glossary;
