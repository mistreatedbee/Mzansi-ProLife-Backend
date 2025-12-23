import express from 'express';
import ChatConversation from '../models/ChatConversation.js';
import Submission from '../models/Submission.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

const router = express.Router();

// Facebook Messenger Webhook Verification
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.MESSENGER_VERIFY_TOKEN) {
    console.log('✅ Facebook Messenger webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Facebook Messenger Webhook Handler
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Respond immediately to Facebook
    res.status(200).send('OK');

    // Process webhook
    if (body.object === 'page') {
      for (const entry of body.entry) {
        const webhookEvent = entry.messaging[0];
        const senderId = webhookEvent.sender.id;

        // Handle incoming messages
        if (webhookEvent.message) {
          await handleIncomingMessengerMessage(webhookEvent, senderId);
        }

        // Handle postbacks (button clicks)
        if (webhookEvent.postback) {
          await handlePostback(webhookEvent, senderId);
        }
      }
    }
  } catch (error) {
    console.error('Messenger webhook error:', error);
    res.status(200).send('OK');
  }
});

// Handle incoming Messenger message
async function handleIncomingMessengerMessage(event, senderId) {
  try {
    const messageText = event.message.text || '';
    const timestamp = event.timestamp;

    // Find or create conversation
    let conversation = await ChatConversation.findOne({
      'metadata.platform': 'messenger',
      'metadata.senderId': senderId,
    });

    if (!conversation) {
      conversation = await ChatConversation.create({
        user: null,
        platform: 'messenger',
        metadata: {
          senderId,
          platform: 'messenger',
        },
        messages: [],
        status: 'active',
      });
    }

    // Add incoming message
    conversation.messages.push({
      role: 'user',
      content: messageText,
      timestamp: new Date(timestamp),
      metadata: {
        platform: 'messenger',
      },
    });

    // Process with chatbot (same logic as WhatsApp)
    const botResponse = await processChatbotMessage(messageText, conversation);

    // Add bot response
    conversation.messages.push({
      role: 'assistant',
      content: botResponse.text,
      timestamp: new Date(),
      metadata: {
        platform: 'messenger',
        action: botResponse.action,
      },
    });

    // Update conversation
    conversation.lastMessageAt = new Date();
    conversation.messageCount = conversation.messages.length;
    if (botResponse.escalate) {
      conversation.escalated = true;
      conversation.status = 'escalated';
    }

    await conversation.save();

    // Send response via Messenger API
    await sendMessengerMessage(senderId, botResponse.text);

    // Create submission if needed
    if (botResponse.action === 'create_submission') {
      await createSubmissionFromChat(conversation, botResponse.submissionData);
    }
  } catch (error) {
    console.error('Error handling incoming Messenger message:', error);
  }
}

// Handle postback (button clicks)
async function handlePostback(event, senderId) {
  try {
    const payload = event.postback.payload;
    
    // Process postback payload
    const botResponse = await processChatbotMessage(payload, null);
    
    // Send response
    await sendMessengerMessage(senderId, botResponse.text);
  } catch (error) {
    console.error('Error handling postback:', error);
  }
}

// Process chatbot message (shared with WhatsApp)
async function processChatbotMessage(messageText, conversation) {
  const text = messageText.toLowerCase().trim();

  // Same chatbot logic as WhatsApp
  if (text.match(/^(hi|hello|hey|greetings)/i)) {
    return {
      text: `Hello! Welcome to Mzansi Prolife Development Institute NPC. 

I'm here to help you with:
• Becoming a Social Change Ambassador
• Making a Donation
• Ordering Products
• Job Applications
• General Questions

How can I assist you today?`,
      action: 'greeting',
      escalate: false,
    };
  }

  // Ambassador flow
  if (text.match(/(ambassador|become.*ambassador|social change)/i)) {
    return {
      text: `Great! To become a Social Change Ambassador, I'll need some information.

Please provide:
1. Your full name
2. Email address
3. Phone number
4. Location/Area

Or visit our website to fill out the complete application form.`,
      action: 'ambassador_interest',
      escalate: false,
    };
  }

  // Donation flow
  if (text.match(/(donate|donation|contribute|give|support)/i)) {
    return {
      text: `Thank you for your interest in supporting us! 

You can make a donation by:
1. EFT to our bank account
2. Using our online form

Would you like:
• Bank details
• Online form link
• More information`,
      action: 'donation_interest',
      escalate: false,
    };
  }

  // Human handover
  if (text.match(/(human|agent|person|speak.*someone)/i)) {
    return {
      text: `I'll connect you with one of our team members. 

Please wait while I transfer you. In the meantime, you can also:
• Email: mzansiprolifedevelopment@gmail.com
• Call: 073 735 3200

Someone will be with you shortly!`,
      action: 'human_handover',
      escalate: true,
    };
  }

  // Default response
  return {
    text: `I understand you're asking about: "${messageText}"

I can help you with:
• Becoming an Ambassador
• Making a Donation
• Ordering Products
• Job Applications
• General Questions

Or type "human" to speak with a team member.`,
    action: 'default',
    escalate: false,
  };
}

// Send Messenger message via Graph API
async function sendMessengerMessage(senderId, messageText) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text: messageText },
          access_token: process.env.MESSENGER_PAGE_ACCESS_TOKEN,
        }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Messenger API error:', data);
      throw new Error(data.error?.message || 'Failed to send Messenger message');
    }

    return data;
  } catch (error) {
    console.error('Error sending Messenger message:', error);
    throw error;
  }
}

// Create submission from chat conversation
async function createSubmissionFromChat(conversation, submissionData) {
  try {
    const submission = await Submission.create({
      submission_type: submissionData.type || 'question_comment',
      status: 'new',
      ...submissionData,
      metadata: {
        source: 'messenger',
        conversationId: conversation._id,
      },
    });

    conversation.metadata.submissionId = submission._id;
    await conversation.save();

    return submission;
  } catch (error) {
    console.error('Error creating submission from chat:', error);
    throw error;
  }
}

// Send Messenger message (admin endpoint)
router.post('/send', authenticate, async (req, res) => {
  try {
    const { senderId, message } = req.body;

    if (!senderId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Sender ID and message are required',
      });
    }

    const result = await sendMessengerMessage(senderId, message);

    await createAuditLog(req, 'messenger_sent', 'communication', null, {
      senderId,
      message,
    });

    res.json({
      success: true,
      message: 'Messenger message sent successfully',
      data: result,
    });
  } catch (error) {
    console.error('Send Messenger error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send Messenger message',
      error: error.message,
    });
  }
});

// Get Messenger conversations (admin endpoint)
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const conversations = await ChatConversation.find({
      'metadata.platform': 'messenger',
    })
      .sort({ lastMessageAt: -1 })
      .limit(100);

    res.json({
      success: true,
      count: conversations.length,
      data: {
        conversations,
      },
    });
  } catch (error) {
    console.error('Get Messenger conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

export default router;

