import mongoose from 'mongoose';

const communicationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['email', 'whatsapp', 'sms', 'facebook', 'internal_note']
  },
  recipient: {
    type: String,
    required: true
  },
  subject: String,
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending'
  },
  relatedTo: {
    entity: {
      type: String,
      enum: ['submission', 'user', 'donation', 'general']
    },
    entityId: mongoose.Schema.Types.ObjectId
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  template: String, // Template used if any
  attachments: [{
    url: String,
    name: String,
    type: String
  }],
  metadata: mongoose.Schema.Types.Mixed,
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  error: String,
  created_date: {
    type: Date,
    default: Date.now
  }
});

communicationSchema.index({ recipient: 1 });
communicationSchema.index({ sentBy: 1 });
communicationSchema.index({ status: 1 });
communicationSchema.index({ created_date: -1 });
communicationSchema.index({ 'relatedTo.entity': 1, 'relatedTo.entityId': 1 });

const Communication = mongoose.model('Communication', communicationSchema);

export default Communication;

