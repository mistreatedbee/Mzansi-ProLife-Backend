import mongoose from 'mongoose';

const contentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['page', 'section', 'gallery', 'media', 'text', 'announcement']
  },
  key: {
    type: String,
    required: true,
    unique: true
  },
  title: String,
  content: mongoose.Schema.Types.Mixed, // Can be string, object, or array
  metadata: {
    description: String,
    tags: [String],
    category: String
  },
  media: [{
    url: String,
    type: String, // image, video, document
    alt: String,
    caption: String
  }],
  isPublished: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  created_date: {
    type: Date,
    default: Date.now
  },
  updated_date: {
    type: Date,
    default: Date.now
  }
});

contentSchema.pre('save', function(next) {
  this.updated_date = Date.now();
  next();
});

contentSchema.index({ key: 1 });
contentSchema.index({ type: 1 });
contentSchema.index({ isPublished: 1 });

const Content = mongoose.model('Content', contentSchema);

export default Content;

