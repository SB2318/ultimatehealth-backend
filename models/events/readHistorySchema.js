const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const readingHistorySchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    articleId: {
        type: Number,
        required: true,
        ref: 'Article'
    },
    dateRead:{
        type: Date,
        default: Date.now
    },
});

// Prevent duplicate entry at exact same time
readingHistorySchema.index({userId: 1, dateRead: -1}, {unique: true});

const ReadingHistory = mongoose.model('ReadingHistory', readingHistorySchema);
module.exports = ReadingHistory;