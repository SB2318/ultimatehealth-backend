// routes/review.routes.js

const express = require("express");
const router = express.Router();
const { loadReviewComments } = require("../controllers/commentController");

router.get("/load", loadReviewComments);

module.exports = router;
