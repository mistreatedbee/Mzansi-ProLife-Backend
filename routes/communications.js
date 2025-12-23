import express from 'express';
import Communication from '../models/Communication.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

const router = express.Router();

// All routes require admin
router.use(authenticate);
router.use(isAdmin);

// @route   POST /api/communications/send
// @desc    Send communication (email, WhatsApp, etc.)
// @access  Private/Admin
router.post('/send', async (req, res) => {
  try {
    const { type, recipient, subject, message, relatedTo, template, attachments } = req.body;

    // Create communication record
    const communication = await Communication.create({
      type,
      recipient,
      subject,
      message,
      relatedTo,
      template,
      attachments,
      sentBy: req.user._id,
      status: 'pending'
    });

    // TODO: Integrate with actual email/WhatsApp services
    // For now, we'll just mark as sent
    // In production, integrate with:
    // - Email: SendGrid, Mailgun, AWS SES
    // - WhatsApp: Twilio, WhatsApp Business API
    // - SMS: Twilio, AWS SNS

    // Simulate sending (replace with actual service)
    communication.status = 'sent';
    communication.sentAt = new Date();
    await communication.save();

    await createAuditLog(req, 'email_sent', 'communication', communication._id);

    res.json({
      success: true,
      message: 'Communication sent successfully',
      data: {
        communication
      }
    });
  } catch (error) {
    console.error('Send communication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/communications
// @desc    Get all communications
// @access  Private/Admin
router.get('/', async (req, res) => {
  try {
    const { type, status, recipient, page = 1, limit = 50 } = req.query;
    const query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (recipient) query.recipient = { $regex: recipient, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const communications = await Communication.find(query)
      .sort({ created_date: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('sentBy', 'name email')
      .populate('relatedTo.entityId');

    const total = await Communication.countDocuments(query);

    res.json({
      success: true,
      count: communications.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: {
        communications
      }
    });
  } catch (error) {
    console.error('Get communications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/communications/:id
// @desc    Get single communication
// @access  Private/Admin
router.get('/:id', async (req, res) => {
  try {
    const communication = await Communication.findById(req.params.id)
      .populate('sentBy', 'name email')
      .populate('relatedTo.entityId');

    if (!communication) {
      return res.status(404).json({
        success: false,
        message: 'Communication not found'
      });
    }

    res.json({
      success: true,
      data: {
        communication
      }
    });
  } catch (error) {
    console.error('Get communication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/communications/history/:entityType/:entityId
// @desc    Get communication history for an entity
// @access  Private/Admin
router.get('/history/:entityType/:entityId', async (req, res) => {
  try {
    const communications = await Communication.find({
      'relatedTo.entity': req.params.entityType,
      'relatedTo.entityId': req.params.entityId
    })
      .sort({ created_date: -1 })
      .populate('sentBy', 'name email');

    res.json({
      success: true,
      count: communications.length,
      data: {
        communications
      }
    });
  } catch (error) {
    console.error('Get communication history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;

