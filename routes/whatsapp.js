import express from 'express';
import ChatConversation from '../models/ChatConversation.js';
import Submission from '../models/Submission.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

const router = express.Router();

// WhatsApp Webhook Verification (GET request from Meta)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Verify token matches your configured token
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// WhatsApp Webhook Handler (POST request from Meta)
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Verify webhook signature (in production, verify with Meta's signature)
    if (process.env.WHATSAPP_WEBHOOK_SECRET) {
      // Add signature verification here
    }

    // Respond immediately to Meta (200 OK)
    res.status(200).send('OK');

    // Process webhook asynchronously
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Handle incoming messages
      if (value?.messages) {
        for (const message of value.messages) {
          await handleIncomingMessage(message, value.metadata);
        }
      }

      // Handle message status updates
      if (value?.statuses) {
        for (const status of value.statuses) {
          await handleMessageStatus(status);
        }
      }
    }
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    // Still return 200 to Meta to prevent retries
    res.status(200).send('OK');
  }
});

// Handle incoming WhatsApp message
async function handleIncomingMessage(message, metadata) {
  try {
    const phoneNumber = message.from;
    const messageText = message.text?.body || '';
    const messageId = message.id;
    const timestamp = parseInt(message.timestamp) * 1000;

    // Find or create conversation
    let conversation = await ChatConversation.findOne({
      'metadata.platform': 'whatsapp',
      'metadata.phoneNumber': phoneNumber,
    });

    if (!conversation) {
      conversation = await ChatConversation.create({
        user: null, // Will be linked if user exists
        platform: 'whatsapp',
        metadata: {
          phoneNumber,
          platform: 'whatsapp',
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
        messageId,
        platform: 'whatsapp',
      },
    });

    // Process with chatbot logic
    const botResponse = await processChatbotMessage(messageText, conversation);

    // Add bot response
    conversation.messages.push({
      role: 'assistant',
      content: botResponse.text,
      timestamp: new Date(),
      metadata: {
        platform: 'whatsapp',
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

    // Send response via WhatsApp API
    await sendWhatsAppMessage(phoneNumber, botResponse.text);

    // If user wants to submit questionnaire, create submission
    if (botResponse.action === 'create_submission') {
      await createSubmissionFromChat(conversation, botResponse.submissionData);
    }
  } catch (error) {
    console.error('Error handling incoming WhatsApp message:', error);
  }
}

// Process chatbot message with rule-based flows
async function processChatbotMessage(messageText, conversation) {
  const text = messageText.toLowerCase().trim();

  // Greeting flow
  if (text.match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/i)) {
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

Or type "form" to fill out the complete application form.`,
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
• Bank details (type "bank")
• Online form link (type "form")
• More information (type "info")`,
      action: 'donation_interest',
      escalate: false,
    };
  }

  // Product order flow
  if (text.match(/(order|buy|product|purchase|shop)/i)) {
    return {
      text: `I can help you order products! 

Please provide:
1. Product name/description
2. Quantity
3. Your contact details

Or type "form" to access our product order form.`,
      action: 'product_order',
      escalate: false,
    };
  }

  // Job application flow
  if (text.match(/(job|career|employment|apply|position|vacancy)/i)) {
    return {
      text: `We'd love to have you on our team!

To apply for a position:
1. Visit our website
2. Fill out the job application form
3. Upload your CV

Type "form" for the application link, or "human" to speak with someone.`,
      action: 'job_interest',
      escalate: false,
    };
  }

  // Human handover
  if (text.match(/(human|agent|person|speak.*someone|talk.*person)/i)) {
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

  // Form request
  if (text.match(/(form|application|apply|register)/i)) {
    return {
      text: `Here's the link to our forms:
https://your-domain.com/questionnaire

You can:
• Become an Ambassador
• Make a Donation
• Order Products
• Apply for Jobs
• Submit Questions

Is there anything else I can help with?`,
      action: 'form_link',
      escalate: false,
    };
  }

  // Contact information
  if (text.match(/(contact|email|phone|address|location)/i)) {
    return {
      text: `Here's how to reach us:

📧 Email: mzansiprolifedevelopment@gmail.com
📱 Phone: 073 735 3200
🌐 Website: https://your-domain.com

Would you like to:
• Fill out a form (type "form")
• Speak with someone (type "human")`,
      action: 'contact_info',
      escalate: false,
    };
  }

  // Default response
  return {
    text: `I understand you're asking about: "${messageText}"

I can help you with:
• Becoming an Ambassador (type "ambassador")
• Making a Donation (type "donate")
• Ordering Products (type "order")
• Job Applications (type "job")
• General Questions (type "question")

Or type "human" to speak with a team member.`,
    action: 'default',
    escalate: false,
  };
}

// Send WhatsApp message via Meta Graph API
async function sendWhatsAppMessage(phoneNumber, messageText) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: {
            body: messageText,
          },
        }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      throw new Error(data.error?.message || 'Failed to send WhatsApp message');
    }

    return data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

// Handle message status updates
async function handleMessageStatus(status) {
  try {
    // Update message status in database if needed
    console.log('Message status update:', status);
    // You can update conversation messages with delivery status
  } catch (error) {
    console.error('Error handling message status:', error);
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
        source: 'whatsapp',
        conversationId: conversation._id,
      },
    });

    // Link submission to conversation
    conversation.metadata.submissionId = submission._id;
    await conversation.save();

    return submission;
  } catch (error) {
    console.error('Error creating submission from chat:', error);
    throw error;
  }
}

// Send WhatsApp message (admin endpoint)
router.post('/send', authenticate, isAdmin, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and message are required',
      });
    }

    const result = await sendWhatsAppMessage(phoneNumber, message);

    await createAuditLog(req, 'whatsapp_sent', 'communication', null, {
      phoneNumber,
      message,
    });

    res.json({
      success: true,
      message: 'WhatsApp message sent successfully',
      data: result,
    });
  } catch (error) {
    console.error('Send WhatsApp error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send WhatsApp message',
      error: error.message,
    });
  }
});

// Get WhatsApp conversations (admin endpoint)
router.get('/conversations', authenticate, isAdmin, async (req, res) => {
  try {
    const conversations = await ChatConversation.find({
      'metadata.platform': 'whatsapp',
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
    console.error('Get WhatsApp conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

export default router;

