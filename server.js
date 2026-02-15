import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import submissionRoutes from './routes/submissions.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import userRoutes from './routes/users.js';
import contentRoutes from './routes/content.js';
import analyticsRoutes from './routes/analytics.js';
import communicationsRoutes from './routes/communications.js';
import securityRoutes from './routes/security.js';
import whatsappRoutes from './routes/whatsapp.js';
import messengerRoutes from './routes/messenger.js';
import uploadRoutes from './routes/uploads.js';

import { connectDB, disconnectDB } from './config/database.js';

// Load environment variables FIRST
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* ─────────────────────────────
   OPTIONAL SECURITY MIDDLEWARE
───────────────────────────── */
let apiLimiter, authLimiter, securityHeaders, sanitizeRequest;

try {
  const security = await import('./middleware/security.js');
  apiLimiter = security.apiLimiter;
  authLimiter = security.authLimiter;
  securityHeaders = security.securityHeaders;
  sanitizeRequest = security.sanitizeRequest;
} catch {
  apiLimiter = (req, res, next) => next();
  authLimiter = (req, res, next) => next();
  securityHeaders = (req, res, next) => next();
  sanitizeRequest = (req, res, next) => next();
}

/* ─────────────────────────────
   GLOBAL MIDDLEWARE
───────────────────────────── */

// Security headers & sanitization
app.use(securityHeaders);
app.use(sanitizeRequest);

// CORS (Vercel-friendly)
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (configuredOrigins.length === 0 || configuredOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

/* ─────────────────────────────
   DATABASE
───────────────────────────── */
connectDB();

/* ─────────────────────────────
   ROUTES
───────────────────────────── */
app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/communications', communicationsRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/messenger', messengerRoutes);
app.use('/api/uploads', uploadRoutes);

/* ─────────────────────────────
   HEALTH CHECK (PUBLIC)
───────────────────────────── */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Mzansi ProLife Backend',
    timestamp: new Date().toISOString(),
  });
});

/* ─────────────────────────────
   ERROR HANDLING
───────────────────────────── */
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

/* ─────────────────────────────
   GRACEFUL SHUTDOWN
───────────────────────────── */
const shutdown = async () => {
  console.log('\n⚠️ Shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/* ─────────────────────────────
   START SERVER (RENDER SAFE)
───────────────────────────── */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at /api`);
});

export default app;
