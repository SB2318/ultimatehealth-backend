const Glossary = require('../models/Glossary');
const { statusEnum } = require('../utils/StatusEnum');

class GlossaryService {
  async createTerm(data) {
    const term = new Glossary(data);
    return await term.save();
  }

  async getTermBySlug(slug) {
    return await Glossary.findOne({ slug, is_removed: false })
      .populate('categories', 'name slug')
      .populate('relatedTerms', 'term slug shortDescription')
      .populate('authorId', 'username name user_name Profile_image')
      .populate('reviewerId', 'user_name role email');
  }

  async getTermById(id) {
    return await Glossary.findOne({ _id: id, is_removed: false })
      .populate('categories', 'name slug')
      .populate('relatedTerms', 'term slug shortDescription')
      .populate('authorId', 'username name user_name email Profile_image')
      .populate('reviewerId', 'user_name role email');
  }

  async updateTerm(id, updateData) {
    return await Glossary.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteTerm(id) {
    // Soft delete support
    return await Glossary.findByIdAndUpdate(id, { is_removed: true, status: statusEnum.DELETED }, { new: true });
  }

  async listTerms({ page = 1, limit = 20, letter, category, status, language = 'en-IN' }) {
    const query = { is_removed: false };

    if (language) {
      query.language = language;
    }

    if (status) {
      query.status = status;
    } else {
      query.status = statusEnum.PUBLISHED; // Default public view
    }

    if (letter) {
      query.term = { $regex: new RegExp(`^${letter}`, 'i') };
    }

    if (category) {
      query.categories = category;
    }

    const skip = (page - 1) * limit;

    const terms = await Glossary.find(query)
      .select('term slug language shortDescription categories status createdAt')
      .populate('categories', 'name slug')
      .sort({ term: 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Glossary.countDocuments(query);

    return {
      data: terms,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async searchTerms(searchQuery, limit = 10, language = 'en-IN') {
    const filter = {
      $text: { $search: searchQuery },
      status: statusEnum.PUBLISHED,
      is_removed: false,
    };

    if (language) {
      filter.language = language;
    }

    return await Glossary.find(
      filter,
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(Number(limit))
      .select('term slug language shortDescription categories');
  }

  // ==========================================
  // 🩺 REVIEW SYSTEM METHODS (Article Review Equivalent, Direct Document Text)
  // ==========================================

  /**
   * Get unassigned terms queue waiting for a reviewer to pick
   */
  async getUnassignedTerms({ page = 1, limit = 10, language }) {
    const query = {
      status: statusEnum.UNASSIGNED,
      is_removed: false,
    };
    if (language) query.language = language;

    const skip = (page - 1) * limit;
    const [terms, total] = await Promise.all([
      Glossary.find(query)
        .populate('authorId', 'user_name user_handle email Profile_image')
        .populate('categories', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Glossary.countDocuments(query),
    ]);

    return { terms, totalPages: Math.ceil(total / limit), total };
  }

  /**
   * Get in-progress review terms for a specific reviewer
   */
  async getReviewerInProgressTerms(reviewerId, { page = 1, limit = 10 }) {
    const query = {
      reviewerId,
      status: {
        $in: [statusEnum.IN_PROGRESS, statusEnum.REVIEW_PENDING, statusEnum.AWAITING_USER],
      },
      is_removed: false,
    };

    const skip = (page - 1) * limit;
    const [terms, total] = await Promise.all([
      Glossary.find(query)
        .populate('authorId', 'user_name user_handle email Profile_image')
        .populate('categories', 'name slug')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Glossary.countDocuments(query),
    ]);

    return { terms, totalPages: Math.ceil(total / limit), total };
  }

  /**
   * Get completed review terms for a specific reviewer (published or discarded)
   */
  async getReviewerCompletedTerms(reviewerId, { page = 1, limit = 10 }) {
    const query = {
      reviewerId,
      status: { $in: [statusEnum.PUBLISHED, statusEnum.DISCARDED] },
      is_removed: false,
    };

    const skip = (page - 1) * limit;
    const [terms, total] = await Promise.all([
      Glossary.find(query)
        .populate('authorId', 'user_name user_handle email Profile_image')
        .populate('categories', 'name slug')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Glossary.countDocuments(query),
    ]);

    return { terms, totalPages: Math.ceil(total / limit), total };
  }

  /**
   * Pick an unassigned glossary term for review
   */
  async pickTermForReview(termId, reviewerId) {
    const term = await Glossary.findById(termId);
    if (!term || term.is_removed) {
      return { error: 'Glossary term not found', status: 404 };
    }

    if (term.status !== statusEnum.UNASSIGNED) {
      return { error: `Term is already in ${term.status} status and cannot be picked`, status: 400 };
    }

    term.reviewerId = reviewerId;
    term.status = statusEnum.IN_PROGRESS;
    await term.save();

    return { term };
  }

  /**
   * Approve a term: direct publish text to MongoDB
   */
  async approveTerm(termId, reviewerId, updatedContent = {}) {
    const term = await Glossary.findById(termId);
    if (!term || term.is_removed) {
      return { error: 'Glossary term not found', status: 404 };
    }

    if (term.reviewerId && term.reviewerId.toString() !== reviewerId.toString()) {
      return { error: 'You are not assigned to review this glossary term', status: 403 };
    }

    // Direct text updates if reviewer refined the term/definition
    if (updatedContent.term) term.term = updatedContent.term;
    if (updatedContent.definition) term.definition = updatedContent.definition;
    if (updatedContent.shortDescription !== undefined) term.shortDescription = updatedContent.shortDescription;
    if (updatedContent.synonyms) term.synonyms = updatedContent.synonyms;
    if (updatedContent.categories) term.categories = updatedContent.categories;
    if (updatedContent.language) term.language = updatedContent.language;

    term.status = statusEnum.PUBLISHED;
    term.feedback = '';
    term.rejectionReason = '';
    await term.save();

    return { term };
  }

  /**
   * Send feedback/revision request to author
   */
  async sendTermFeedback(termId, reviewerId, feedback) {
    const term = await Glossary.findById(termId);
    if (!term || term.is_removed) {
      return { error: 'Glossary term not found', status: 404 };
    }

    if (term.reviewerId && term.reviewerId.toString() !== reviewerId.toString()) {
      return { error: 'You are not assigned to review this glossary term', status: 403 };
    }

    term.status = statusEnum.AWAITING_USER;
    term.feedback = feedback;
    await term.save();

    return { term };
  }

  /**
   * Reject / Discard a glossary term with reason
   */
  async rejectTerm(termId, reviewerId, rejectionReason) {
    const term = await Glossary.findById(termId);
    if (!term || term.is_removed) {
      return { error: 'Glossary term not found', status: 404 };
    }

    if (term.reviewerId && term.reviewerId.toString() !== reviewerId.toString()) {
      return { error: 'You are not assigned to review this glossary term', status: 403 };
    }

    term.status = statusEnum.DISCARDED;
    term.rejectionReason = rejectionReason;
    await term.save();

    return { term };
  }
}

module.exports = new GlossaryService();
