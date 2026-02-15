import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'create', 'update', 'delete', 'login', 'logout',
      'export', 'view', 'approve', 'reject', 'assign',
      'email_sent', 'whatsapp_sent', 'messenger_sent', 'payment_verified'
    ]
  },
  entity: {
    type: String,
    required: true,
    enum: ['user', 'submission', 'content', 'donation', 'conversation', 'communication']
  },
  entityId: mongoose.Schema.Types.ObjectId,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changes: mongoose.Schema.Types.Mixed, // Before/after data
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: mongoose.Schema.Types.Mixed
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ user: 1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ action: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;

