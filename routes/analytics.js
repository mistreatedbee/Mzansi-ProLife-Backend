import express from 'express';
import Submission from '../models/Submission.js';
import User from '../models/User.js';
import ChatConversation from '../models/ChatConversation.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require admin
router.use(authenticate);
router.use(isAdmin);

// @route   GET /api/analytics/overview
// @desc    Get overview analytics
// @access  Private/Admin
router.get('/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    
    if (startDate || endDate) {
      dateFilter.created_date = {};
      if (startDate) dateFilter.created_date.$gte = new Date(startDate);
      if (endDate) dateFilter.created_date.$lte = new Date(endDate);
    }

    // User engagement
    const totalUsers = await User.countDocuments();
    const newUsers = await User.countDocuments({
      createdAt: dateFilter.created_date || { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    // Submission analytics
    const totalSubmissions = await Submission.countDocuments(dateFilter);
    const submissionsByType = await Submission.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$submission_type', count: { $sum: 1 } } }
    ]);

    const submissionsByStatus = await Submission.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Donation analytics
    const donationStats = await Submission.aggregate([
      { 
        $match: { 
          ...dateFilter,
          submission_type: 'donate',
          donation_amount: { $exists: true, $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$donation_amount' },
          count: { $sum: 1 },
          average: { $avg: '$donation_amount' },
          min: { $min: '$donation_amount' },
          max: { $max: '$donation_amount' }
        }
      }
    ]);

    // Completion rates
    const completionRate = totalSubmissions > 0 
      ? (await Submission.countDocuments({ ...dateFilter, status: 'completed' }) / totalSubmissions * 100).toFixed(2)
      : 0;

    // Chat analytics
    const totalConversations = await ChatConversation.countDocuments();
    const escalatedConversations = await ChatConversation.countDocuments({ escalated: true });

    // Time-based trends (last 30 days)
    const dailyTrends = await Submission.aggregate([
      {
        $match: {
          created_date: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_date' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          new: newUsers
        },
        submissions: {
          total: totalSubmissions,
          byType: submissionsByType,
          byStatus: submissionsByStatus,
          completionRate: parseFloat(completionRate)
        },
        donations: donationStats[0] || {
          total: 0,
          count: 0,
          average: 0,
          min: 0,
          max: 0
        },
        chat: {
          totalConversations,
          escalatedConversations
        },
        trends: {
          daily: dailyTrends
        }
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/analytics/reports
// @desc    Generate custom reports
// @access  Private/Admin
router.get('/reports', async (req, res) => {
  try {
    const { type, startDate, endDate, format = 'json' } = req.query;
    
    let reportData = {};

    switch (type) {
      case 'user_engagement':
        reportData = await generateUserEngagementReport(startDate, endDate);
        break;
      case 'questionnaire_completion':
        reportData = await generateQuestionnaireCompletionReport(startDate, endDate);
        break;
      case 'donation_summary':
        reportData = await generateDonationReport(startDate, endDate);
        break;
      case 'submission_trends':
        reportData = await generateSubmissionTrendsReport(startDate, endDate);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }

    res.json({
      success: true,
      data: {
        type,
        generatedAt: new Date().toISOString(),
        period: { startDate, endDate },
        report: reportData
      }
    });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Helper functions for reports
async function generateUserEngagementReport(startDate, endDate) {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const users = await User.find(dateFilter);
  const userStats = await Promise.all(
    users.map(async (user) => {
      const submissionCount = await Submission.countDocuments({ user: user._id });
      return {
        userId: user._id,
        name: user.name,
        email: user.email,
        registrationDate: user.createdAt,
        totalSubmissions: submissionCount,
        lastActivity: user.updatedAt
      };
    })
  );

  return {
    totalUsers: users.length,
    users: userStats,
    averageSubmissionsPerUser: userStats.length > 0
      ? (userStats.reduce((sum, u) => sum + u.totalSubmissions, 0) / userStats.length).toFixed(2)
      : 0
  };
}

async function generateQuestionnaireCompletionReport(startDate, endDate) {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.created_date = {};
    if (startDate) dateFilter.created_date.$gte = new Date(startDate);
    if (endDate) dateFilter.created_date.$lte = new Date(endDate);
  }

  const submissions = await Submission.find(dateFilter);
  const byType = await Submission.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$submission_type',
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        }
      }
    }
  ]);

  return {
    total: submissions.length,
    byType: byType.map(item => ({
      type: item._id,
      total: item.total,
      completed: item.completed,
      inProgress: item.inProgress,
      completionRate: ((item.completed / item.total) * 100).toFixed(2) + '%'
    }))
  };
}

async function generateDonationReport(startDate, endDate) {
  const dateFilter = {
    submission_type: 'donate',
    donation_amount: { $exists: true, $gt: 0 }
  };
  
  if (startDate || endDate) {
    dateFilter.created_date = {};
    if (startDate) dateFilter.created_date.$gte = new Date(startDate);
    if (endDate) dateFilter.created_date.$lte = new Date(endDate);
  }

  const donations = await Submission.find(dateFilter);
  const byProject = await Submission.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$project_allocation',
        total: { $sum: '$donation_amount' },
        count: { $sum: 1 },
        average: { $avg: '$donation_amount' }
      }
    }
  ]);

  return {
    totalAmount: donations.reduce((sum, d) => sum + (d.donation_amount || 0), 0),
    totalCount: donations.length,
    byProject: byProject.map(item => ({
      project: item._id || 'Unspecified',
      total: item.total,
      count: item.count,
      average: item.average.toFixed(2)
    }))
  };
}

async function generateSubmissionTrendsReport(startDate, endDate) {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.created_date = {};
    if (startDate) dateFilter.created_date.$gte = new Date(startDate);
    if (endDate) dateFilter.created_date.$lte = new Date(endDate);
  }

  const trends = await Submission.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$created_date' } },
          type: '$submission_type'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  return {
    trends: trends.map(item => ({
      date: item._id.date,
      type: item._id.type,
      count: item.count
    }))
  };
}

export default router;

