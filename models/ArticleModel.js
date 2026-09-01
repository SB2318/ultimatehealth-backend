const mongoose = require('mongoose');
const Schema = mongoose.Schema;



/** For Artcle Tags */
const articleTagSchema = new Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  // Bidirectional relation: Users who have this tag in their notificationPreferences.contentClusters
  subscribers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
});

const ArticleTag = mongoose.model('ArticleTag', articleTagSchema);

module.exports = ArticleTag;
