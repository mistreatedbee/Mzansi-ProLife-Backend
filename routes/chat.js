import express from 'express';
import crypto from 'crypto';
import ChatConversation from '../models/ChatConversation.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/chat/conversations
// @desc    Create or get chat conversation (supports anonymous users)
// @access  Public (for anonymous) or Private (for authenticated)
router.post('/conversations', async (req, res) => {
  try {
    const { session_id, user_name, user_phone } = req.body;
    
    let conversation;
    if (session_id) {
      conversation = await ChatConversation.findOne({ session_id });
    }
    
    if (!conversation) {
      const newSessionId = session_id || crypto.randomUUID();
      const conversationData = {
        session_id: newSessionId,
        platform: 'web',
        messages: []
      };

      // If user is authenticated, use their info
      if (req.user) {
        conversationData.user = req.user._id;
        conversationData.user_name = req.user.name;
        conversationData.user_email = req.user.email;
      } else {
        // For anonymous users, store name and phone
        conversationData.user_name = user_name || 'Anonymous';
        conversationData.user_phone = user_phone || null;
      }

      conversation = await ChatConversation.create(conversationData);
    } else {
      // Update user info if provided
      if (user_name && !conversation.user_name) {
        conversation.user_name = user_name;
      }
      if (user_phone && !conversation.user_phone) {
        conversation.user_phone = user_phone;
      }
      await conversation.save();
    }

    res.json({
      success: true,
      data: {
        conversation
      }
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/chat/messages
// @desc    Add message to conversation (supports anonymous users)
// @access  Public
router.post('/messages', async (req, res) => {
  try {
    const { session_id, role, content, options } = req.body;

    const conversation = await ChatConversation.findOne({ session_id });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    conversation.messages.push({
      role,
      content,
      timestamp: new Date(),
      metadata: {
        options: options || null
      }
    });

    // Update conversation stats
    conversation.lastMessageAt = new Date();
    conversation.messageCount = conversation.messages.length;
    
    // Check if escalated
    if (content && (content.toLowerCase().includes('escalate') || content.toLowerCase().includes('agent') || content.toLowerCase().includes('human'))) {
      conversation.escalated = true;
      conversation.status = 'escalated';
    }

    await conversation.save();

    res.json({
      success: true,
      data: {
        conversation
      }
    });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/chat/conversations/:sessionId
// @desc    Get conversation by session ID
// @access  Private
router.get('/conversations/:sessionId', authenticate, async (req, res) => {
  try {
    const conversation = await ChatConversation.findOne({
      session_id: req.params.sessionId,
      user: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: {
        conversation
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;

