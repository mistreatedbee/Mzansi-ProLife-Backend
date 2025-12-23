import express from 'express';
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

const router = express.Router();

// All routes require admin
router.use(authenticate);
router.use(isAdmin);

// @route   GET /api/users
// @desc    Get all users with filters
// @access  Private/Admin
router.get('/', async (req, res) => {
  try {
    const { search, role, page = 1, limit = 50 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (role && role !== 'all') {
      query.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments(query);

    // Get user activity stats
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const submissionCount = await Submission.countDocuments({ user: user._id });
        return {
          ...user.toObject(),
          submissionCount,
          lastActivity: user.updatedAt
        };
      })
    );

    res.json({
      success: true,
      count: users.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: {
        users: usersWithStats
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get single user with full details
// @access  Private/Admin
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's submissions
    const submissions = await Submission.find({ user: user._id })
      .sort({ created_date: -1 })
      .limit(10);

    // Get statistics
    const stats = {
      totalSubmissions: await Submission.countDocuments({ user: user._id }),
      submissionsByType: await Submission.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: '$submission_type', count: { $sum: 1 } } }
      ]),
      lastActivity: user.updatedAt
    };

    res.json({
      success: true,
      data: {
        user,
        submissions,
        stats
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user (admin)
// @access  Private/Admin
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, role, isEmailVerified } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (role) updateData.role = role;
    if (isEmailVerified !== undefined) updateData.isEmailVerified = isEmailVerified;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await createAuditLog(req, 'update', 'user', user._id, updateData);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (soft delete - set inactive)
// @access  Private/Admin
router.delete('/:id', async (req, res) => {
  try {
    // Instead of deleting, we can mark as inactive
    // Or actually delete if needed
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await createAuditLog(req, 'delete', 'user', user._id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/:id/activity
// @desc    Get user activity log
// @access  Private/Admin
router.get('/:id/activity', async (req, res) => {
  try {
    const AuditLog = (await import('../models/AuditLog.js')).default;
    const activities = await AuditLog.find({ user: req.params.id })
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('user', 'name email');

    res.json({
      success: true,
      count: activities.length,
      data: {
        activities
      }
    });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;
