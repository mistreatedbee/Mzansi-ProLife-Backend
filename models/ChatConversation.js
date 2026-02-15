import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    messageId: String, // For WhatsApp/Messenger message IDs
    platform: String,
    action: String, // Chatbot action taken
    escalated: Boolean
  }
});

const chatConversationSchema = new mongoose.Schema({
  session_id: {
    type: String,
    required: true,
    unique: true,
    sparse: true // Allow null for WhatsApp/Messenger
  },
  messages: [messageSchema],
  user_name: String,
  user_email: String,
  user_phone: String, // Store phone number for anonymous users
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  platform: {
    type: String,
    enum: ['web', 'whatsapp', 'messenger'],
    default: 'web'
  },
  metadata: {
    phoneNumber: String, // For WhatsApp
    senderId: String, // For Messenger
    platform: String,
    sessionToken: String, // For anonymous web chat ownership
    submissionId: mongoose.Schema.Types.ObjectId,
    conversationId: String
  },
  escalated: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'resolved', 'archived', 'escalated'],
    default: 'active'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  messageCount: {
    type: Number,
    default: 0
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

// Update updated_date on save
chatConversationSchema.pre('save', function(next) {
  this.updated_date = Date.now();
  next();
});

// Indexes
chatConversationSchema.index({ session_id: 1 });
chatConversationSchema.index({ user: 1 });
chatConversationSchema.index({ status: 1 });
chatConversationSchema.index({ platform: 1 });
chatConversationSchema.index({ created_date: -1 });
chatConversationSchema.index({ lastMessageAt: -1 });
chatConversationSchema.index({ 'metadata.platform': 1 });
chatConversationSchema.index({ 'metadata.phoneNumber': 1 });
chatConversationSchema.index({ 'metadata.senderId': 1 });

const ChatConversation = mongoose.model('ChatConversation', chatConversationSchema);

export default ChatConversation;

