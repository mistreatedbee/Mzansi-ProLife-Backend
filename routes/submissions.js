import express from 'express';
import { body, validationResult } from 'express-validator';
import Submission from '../models/Submission.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/submissions
// @desc    Create a new submission
// @access  Private
router.post('/', authenticate, async (req, res) => {
  try {
    const submissionData = {
      ...req.body,
      user: req.user._id,
      email: req.body.email || req.user.email
    };

    const submission = await Submission.create(submissionData);

    res.status(201).json({
      success: true,
      message: 'Submission created successfully',
      data: {
        submission
      }
    });
  } catch (error) {
    console.error('Create submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/submissions
// @desc    Get user's submissions
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, status, project, startDate, endDate, search } = req.query;
    const query = { user: req.user._id };

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
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const submissions = await Submission.find(query)
      .sort({ created_date: -1 })
      .populate('user', 'name email');

    res.json({
      success: true,
      count: submissions.length,
      data: {
        submissions
      }
    });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/submissions/:id
// @desc    Get single submission
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const submission = await Submission.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('user', 'name email');

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

// @route   PUT /api/submissions/:id
// @desc    Update submission (limited fields for users)
// @access  Private
router.put('/:id', authenticate, async (req, res) => {
  try {
    const submission = await Submission.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Users can only update certain fields
    const allowedUpdates = ['phone', 'address', 'city', 'postal_code'];
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({
        success: false,
        message: 'Invalid updates. Users can only update contact information.'
      });
    }

    Object.assign(submission, req.body);
    await submission.save();

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

export default router;

