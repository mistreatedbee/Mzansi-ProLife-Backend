import express from 'express';
import Submission from '../models/Submission.js';
import ChatConversation from '../models/ChatConversation.js';
import User from '../models/User.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(isAdmin);

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics
// @access  Private/Admin
router.get('/stats', async (req, res) => {
  try {
    const totalSubmissions = await Submission.countDocuments();
    const newSubmissions = await Submission.countDocuments({ status: 'new' });
    const inProgress = await Submission.countDocuments({ status: 'in_progress' });
    const completed = await Submission.countDocuments({ status: 'completed' });
    
    // Calculate total donations
    const donations = await Submission.aggregate([
      { $match: { submission_type: 'donate', donation_amount: { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$donation_amount' } } }
    ]);
    const totalDonations = donations.length > 0 ? donations[0].total : 0;

    // Submissions by type
    const byType = await Submission.aggregate([
      { $group: { _id: '$submission_type', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        totalSubmissions,
        newSubmissions,
        inProgress,
        completed,
        totalDonations,
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/admin/submissions
// @desc    Get all submissions with filters
// @access  Private/Admin
router.get('/submissions', async (req, res) => {
  try {
    const { type, status, project, startDate, endDate, search, page = 1, limit = 50 } = req.query;
    const query = {};

    // Apply filters
    if (type && type !== 'all') {
      query.submission_type = type;
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    if (project && project !== 'all') {
      query.project_allocation = project;
    }
    if (startDate || endDate) {
      query.created_date = {};
      if (startDate) query.created_date.$gte = new Date(startDate);
      if (endDate) query.created_date.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { reference_number: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { id_number: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const submissions = await Submission.find(query)
      .sort({ created_date: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('user', 'name email');

    const total = await Submission.countDocuments(query);

    res.json({
      success: true,
      count: submissions.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: {
        submissions
      }
    });
  } catch (error) {
    console.error('Get admin submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/admin/submissions/:id
// @desc    Get single submission (admin)
// @access  Private/Admin
router.get('/submissions/:id', async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('user', 'name email phone');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    res.json({
      success: true,
      data: {
        submission
      }
    });
  } catch (error) {
    console.error('Get submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/submissions/:id
// @desc    Update submission (admin can update all fields)
// @access  Private/Admin
router.put('/submissions/:id', async (req, res) => {
  try {
    const submission = await Submission.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    await createAuditLog(req, 'update', 'submission', submission._id, req.body);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    res.json({
      success: true,
      message: 'Submission updated successfully',
      data: {
        submission
      }
    });
  } catch (error) {
    console.error('Update submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/admin/conversations
// @desc    Get all chat conversations
// @access  Private/Admin
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await ChatConversation.find()
      .sort({ created_date: -1 })
      .populate('user', 'name email')
      .limit(100);

    res.json({
      success: true,
      count: conversations.length,
      data: {
        conversations
      }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/admin/donations
// @desc    Get all donations with filters
// @access  Private/Admin
router.get('/donations', async (req, res) => {
  try {
    const { startDate, endDate, project, verified, page = 1, limit = 50 } = req.query;
    const query = {
      submission_type: 'donate',
      donation_amount: { $exists: true, $gt: 0 }
    };

    if (startDate || endDate) {
      query.created_date = {};
      if (startDate) query.created_date.$gte = new Date(startDate);
      if (endDate) query.created_date.$lte = new Date(endDate);
    }
    if (project && project !== 'all') {
      query.project_allocation = project;
    }
    if (verified !== undefined) {
      query.proof_of_payment_url = verified === 'true' ? { $exists: true, $ne: '' } : { $exists: false };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const donations = await Submission.find(query)
      .sort({ created_date: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('user', 'name email');

    const total = await Submission.countDocuments(query);

    // Calculate totals
    const totals = await Submission.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$donation_amount' },
          count: { $sum: 1 },
          average: { $avg: '$donation_amount' }
        }
      }
    ]);

    res.json({
      success: true,
      count: donations.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      totals: totals[0] || { totalAmount: 0, count: 0, average: 0 },
      data: {
        donations
      }
    });
  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/donations/:id/verify
// @desc    Verify donation payment
// @access  Private/Admin
router.put('/donations/:id/verify', async (req, res) => {
  try {
    const submission = await Submission.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'completed',
        notes: (req.body.notes || '') + '\nPayment verified by admin'
      },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    res.json({
      success: true,
      message: 'Donation verified successfully',
      data: {
        submission
      }
    });
  } catch (error) {
    console.error('Verify donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;

