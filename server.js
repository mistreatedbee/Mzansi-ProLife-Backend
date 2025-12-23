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

// Security middleware (optional - install if needed)
let apiLimiter, authLimiter, securityHeaders, sanitizeRequest;
try {
  const security = await import('./middleware/security.js');
  apiLimiter = security.apiLimiter;
  authLimiter = security.authLimiter;
  securityHeaders = security.securityHeaders;
  sanitizeRequest = security.sanitizeRequest;
} catch (error) {
  console.warn('Security middleware not available, using basic setup');
  // Basic rate limiting fallback
  apiLimiter = (req, res, next) => next();
  authLimiter = (req, res, next) => next();
  securityHeaders = (req, res, next) => next();
  sanitizeRequest = (req, res, next) => next();
}

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware (if available)
if (securityHeaders) app.use(securityHeaders);
if (sanitizeRequest) app.use(sanitizeRequest);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (if available)
if (apiLimiter) {
  app.use('/api/', apiLimiter);
}
if (authLimiter) {
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

// MongoDB Connection
connectDB();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️ Shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️ Shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});

// Routes
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Mzansi Prolife API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});

export default app;

