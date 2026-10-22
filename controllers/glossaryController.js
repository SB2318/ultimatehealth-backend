const expressAsyncHandler = require('express-async-handler');
const glossaryService = require('../services/glossaryService');
const { throwError } = require('../utils/throwError');

module.exports.createTerm = expressAsyncHandler(async (req, res) => {
  const authorId = req.userId;
  const data = { ...req.validateBody, authorId };
  
  const term = await glossaryService.createTerm(data);
  res.status(201).json({ message: 'Glossary term created successfully', term });
});

module.exports.getTerm = expressAsyncHandler(async (req, res) => {
  const { slug } = req.params;
  const term = await glossaryService.getTermBySlug(slug);
  
  if (!term) {
    throwError(404, 'NOT_FOUND', 'Glossary term not found');
  }
  
  res.status(200).json({ term });
});

module.exports.updateTerm = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.validateBody;
  
  const updatedTerm = await glossaryService.updateTerm(id, updateData);
  
  if (!updatedTerm) {
    throwError(404, 'NOT_FOUND', 'Glossary term not found');
  }
  
  res.status(200).json({ message: 'Glossary term updated successfully', term: updatedTerm });
});

module.exports.deleteTerm = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const deletedTerm = await glossaryService.deleteTerm(id);
  
  if (!deletedTerm) {
    throwError(404, 'NOT_FOUND', 'Glossary term not found');
  }
  
  res.status(200).json({ message: 'Glossary term deleted successfully' });
});

module.exports.listTerms = expressAsyncHandler(async (req, res) => {
  const { page, limit, letter, category, status, language } = req.query;
  const result = await glossaryService.listTerms({ page, limit, letter, category, status, language });
  
  res.status(200).json(result);
});

module.exports.searchTerms = expressAsyncHandler(async (req, res) => {
  const { q, limit, language } = req.query;
  
  if (!q) {
    throwError(400, 'BAD_REQUEST', 'Search query is required');
  }
  
  const results = await glossaryService.searchTerms(q, limit, language);
  res.status(200).json({ results });
});

module.exports.getUnassignedGlossaryQueue = expressAsyncHandler(async (req, res) => {
  const { page = 1, limit = 10, language } = req.query;
  const result = await glossaryService.getUnassignedTerms({ page, limit, language });
  res.status(200).json(result);
});

module.exports.getReviewerInProgressGlossary = expressAsyncHandler(async (req, res) => {
  const reviewerId = req.userId;
  const { page = 1, limit = 10 } = req.query;
  const result = await glossaryService.getReviewerInProgressTerms(reviewerId, { page, limit });
  res.status(200).json(result);
});

module.exports.getReviewerCompletedGlossary = expressAsyncHandler(async (req, res) => {
  const reviewerId = req.userId;
  const { page = 1, limit = 10 } = req.query;
  const result = await glossaryService.getReviewerCompletedTerms(reviewerId, { page, limit });
  res.status(200).json(result);
});

module.exports.pickGlossaryTerm = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.userId;

  const result = await glossaryService.pickTermForReview(id, reviewerId);
  if (result.error) {
    return res.status(result.status).json({ message: result.error });
  }

  res.status(200).json({ message: 'Glossary term picked for review successfully', term: result.term });
});

module.exports.approveGlossaryTerm = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.userId;
  const updatedContent = req.body || {};

  const result = await glossaryService.approveTerm(id, reviewerId, updatedContent);
  if (result.error) {
    return res.status(result.status).json({ message: result.error });
  }

  res.status(200).json({ message: 'Glossary term approved and published successfully', term: result.term });
});

module.exports.sendGlossaryFeedback = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.userId;
  const { feedback } = req.body;

  if (!feedback || !feedback.trim()) {
    return res.status(400).json({ message: 'Feedback is required' });
  }

  const result = await glossaryService.sendTermFeedback(id, reviewerId, feedback);
  if (result.error) {
    return res.status(result.status).json({ message: result.error });
  }

  res.status(200).json({ message: 'Feedback sent to author successfully', term: result.term });
});

module.exports.rejectGlossaryTerm = expressAsyncHandler(async (req, res) => {
  const { id } = req.params;
  const reviewerId = req.userId;
  const { rejectionReason } = req.body;

  if (!rejectionReason || !rejectionReason.trim()) {
    return res.status(400).json({ message: 'Rejection reason is required' });
  }

  const result = await glossaryService.rejectTerm(id, reviewerId, rejectionReason);
  if (result.error) {
    return res.status(result.status).json({ message: result.error });
  }

  res.status(200).json({ message: 'Glossary term rejected', term: result.term });
});
