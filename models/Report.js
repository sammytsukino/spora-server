const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  reportedFlora: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flora',
    required: true,
  },
  category: {
    type: String,
    enum: ['spam', 'harassment', 'inappropriate', 'other', 'language_review'],
    required: true,
  },
  source: {
    type: String,
    enum: ['user', 'language_screen'],
    default: 'user',
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    maxlength: [200, 'Reason must not exceed 200 characters'],
  },
  description: {
    type: String,
    maxlength: [2000, 'Description must not exceed 2000 characters'],
  },
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
    default: 'pending'
  },
  action: {
    type: String,
    enum: ['none', 'flora_hidden', 'flora_removed', 'user_warned', 'user_suspended']
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminNotes: {
    type: String,
    maxlength: [500, 'Admin notes must not exceed 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  }
});

module.exports = mongoose.model('Report', reportSchema);
