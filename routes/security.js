import express from 'express';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require admin
router.use(authenticate);
router.use(isAdmin);

// @route   GET /api/security/audit-logs
// @desc    Get audit logs
// @access  Private/Admin
router.get('/audit-logs', async (req, res) => {
  try {
    const { action, entity, userId, startDate, endDate, page = 1, limit = 100 } = req.query;
    const query = {};

    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (userId) query.user = userId;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('user', 'name email role');

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      count: logs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: {
        logs
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/security/compliance
// @desc    Get compliance report
// @access  Private/Admin
router.get('/compliance', async (req, res) => {
  try {
    // POPIA Compliance checks
    const totalUsers = await User.countDocuments();
    const usersWithConsent = await User.countDocuments({ isEmailVerified: true });
    
    // Data retention check (users inactive for > 1 year)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const inactiveUsers = await User.countDocuments({
      updatedAt: { $lt: oneYearAgo }
    });

    // Recent data access
    const recentAccess = await AuditLog.countDocuments({
      action: { $in: ['view', 'export'] },
      timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    // Data exports
    const dataExports = await AuditLog.countDocuments({
      action: 'export',
      timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      data: {
        popia: {
          totalUsers,
          usersWithConsent,
          consentRate: ((usersWithConsent / totalUsers) * 100).toFixed(2) + '%',
          inactiveUsers,
          dataRetentionCompliant: inactiveUsers < totalUsers * 0.1 // Less than 10% inactive
        },
        dataAccess: {
          recentAccess,
          dataExports,
          last30Days: {
            accessCount: recentAccess,
            exportCount: dataExports
          }
        },
        recommendations: [
          inactiveUsers > 0 ? 'Review inactive user accounts for data retention compliance' : null,
          usersWithConsent < totalUsers * 0.9 ? 'Improve user consent collection rate' : null
        ].filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Get compliance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/security/user-consent/:userId
// @desc    Get user consent status
// @access  Private/Admin
router.get('/user-consent/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name email isEmailVerified createdAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's data access history
    const accessHistory = await AuditLog.find({
      'changes.userId': user._id,
      action: { $in: ['view', 'export', 'update'] }
    })
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          emailVerified: user.isEmailVerified,
          registeredAt: user.createdAt
        },
        consent: {
          emailConsent: user.isEmailVerified,
          dataProcessingConsent: true, // Assume true if user registered
          marketingConsent: false // Would need separate field
        },
        dataAccess: {
          history: accessHistory,
          lastAccess: accessHistory[0]?.timestamp || null
        }
      }
    });
  } catch (error) {
    console.error('Get user consent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;

