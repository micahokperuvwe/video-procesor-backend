import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

import authRoutes from './routes/auth.routes';
import authEmailRoutes from './routes/auth-email.routes';
import userRoutes from './routes/users.routes';
import videoRoutes from './routes/video.routes';
import analyticsRoutes from './routes/analytics.routes';
import notificationsRoutes from './routes/notifications.routes';
import subscriptionRoutes from './routes/subscriptions.routes';
import adminRoutes from './routes/admin.routes';
import webhooksRoutes from './routes/webhooks.routes';
import apiKeysRoutes from './routes/api-keys.routes';
import activityLogsRoutes from './routes/activity-logs.routes';

const app = express();

// Middlewares
app.use(cors({
  origin: '*', // Allow all in dev
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Increase payload size limits for video uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routing mounts
app.use('/api/auth', authRoutes);
app.use('/api/auth', authEmailRoutes);
app.use('/api/users', userRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/webhooks', webhooksRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/activity-logs', activityLogsRoutes);

// Base index route
app.get('/', (req, res) => {
  res.json({
    name: 'VeloStream API',
    version: '1.0.0',
    status: 'ONLINE',
    endpoints: {
      auth: '/api/auth',
      videos: '/api/videos',
      analytics: '/api/analytics',
      webhooks: '/webhooks'
    }
  });
});

// Error handling fallback
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[GLOBAL ERROR ROUTER]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

export default app;
