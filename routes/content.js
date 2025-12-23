import express from 'express';
import Content from '../models/Content.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

const router = express.Router();

// All routes require admin
router.use(authenticate);
router.use(isAdmin);

// @route   GET /api/content
// @desc    Get all content
// @access  Private/Admin
router.get('/', async (req, res) => {
  try {
    const { type, category, isPublished } = req.query;
    const query = {};

    if (type) query.type = type;
    if (category) query['metadata.category'] = category;
    if (isPublished !== undefined) query.isPublished = isPublished === 'true';

    const contents = await Content.find(query)
      .sort({ updated_date: -1 })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    res.json({
      success: true,
      count: contents.length,
      data: {
        contents
      }
    });
  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/content/:key
// @desc    Get content by key
// @access  Private/Admin
router.get('/:key', async (req, res) => {
  try {
    const content = await Content.findOne({ key: req.params.key })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      data: {
        content
      }
    });
  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/content
// @desc    Create content
// @access  Private/Admin
router.post('/', async (req, res) => {
  try {
    const contentData = {
      ...req.body,
      createdBy: req.user._id,
      updatedBy: req.user._id
    };

    const content = await Content.create(contentData);

    await createAuditLog(req, 'create', 'content', content._id);

    res.status(201).json({
      success: true,
      message: 'Content created successfully',
      data: {
        content
      }
    });
  } catch (error) {
    console.error('Create content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/content/:id
// @desc    Update content
// @access  Private/Admin
router.put('/:id', async (req, res) => {
  try {
    const content = await Content.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user._id
      },
      { new: true, runValidators: true }
    );

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    await createAuditLog(req, 'update', 'content', content._id, req.body);

    res.json({
      success: true,
      message: 'Content updated successfully',
      data: {
        content
      }
    });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/content/:id
// @desc    Delete content
// @access  Private/Admin
router.delete('/:id', async (req, res) => {
  try {
    const content = await Content.findByIdAndDelete(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    await createAuditLog(req, 'delete', 'content', content._id);

    res.json({
      success: true,
      message: 'Content deleted successfully'
    });
  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;

