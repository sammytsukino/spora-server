const mongoose = require('mongoose');

const floraSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    minlength: [1, 'Title must be at least 1 character'],
    maxlength: [100, 'Title must not exceed 100 characters']
  },
  text: {
    type: String,
    required: [true, 'Text is required'],
    minlength: [1, 'Text must be at least 1 character'],
    maxlength: [1000, 'Text must not exceed 1000 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['budding', 'blossoming', 'wilting', 'sealed'],
    default: 'budding'
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  generative: {
    soilId: String,
    soilName: String,
    seed: {
      sentiment: {
        score: Number,
        label: String
      },
      morphology: {
        characterCount: Number,
        wordCount: Number,
        lineCount: Number
      },
      visual: {
        colorPalette: [String],
        elementCount: Number,
        movementSpeed: Number,
        complexity: Number
      }
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Flora', floraSchema);
