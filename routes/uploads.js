import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import Submission from '../models/Submission.js';

const router = express.Router();

// Configure multer for file uploads
// In production, use cloud storage (AWS S3, Cloudinary, etc.)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // In production, upload to cloud storage
    // For now, save to uploads folder (make sure it exists)
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and documents
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
    }
  },
});

// Upload file for submission
router.post('/submission/:submissionId', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { submissionId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Find submission
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    // Update submission with file URL
    // In production, use cloud storage URL
    const fileUrl = `/uploads/${file.filename}`;
    
    if (submission.submission_type === 'donate') {
      submission.proof_of_payment_url = fileUrl;
    } else {
      // For other submission types, store in attachments array
      if (!submission.attachments) {
        submission.attachments = [];
      }
      submission.attachments.push({
        url: fileUrl,
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        uploadedAt: new Date(),
      });
    }

    await submission.save();

    await createAuditLog(req, 'update', 'submission', submission._id, {
      fileUploaded: file.originalname,
    });

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
      },
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: error.message,
    });
  }
});

// Get uploaded files for a submission
router.get('/submission/:submissionId', authenticate, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId);
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    const files = [];
    
    if (submission.proof_of_payment_url) {
      files.push({
        url: submission.proof_of_payment_url,
        type: 'proof_of_payment',
        name: 'Proof of Payment',
      });
    }

    if (submission.attachments && submission.attachments.length > 0) {
      files.push(...submission.attachments);
    }

    res.json({
      success: true,
      count: files.length,
      data: {
        files,
      },
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
});

export default router;

